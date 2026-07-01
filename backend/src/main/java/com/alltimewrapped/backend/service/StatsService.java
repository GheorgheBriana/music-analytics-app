package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import com.alltimewrapped.backend.analytics.repository.DwDimUserRepository;
import com.alltimewrapped.backend.analytics.repository.DwFactListeningEventRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import com.alltimewrapped.backend.model.Genre;
import com.alltimewrapped.backend.model.Track;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final ListeningRecordRepository listeningRecordRepository;
    private final AppUserRepository appUserRepository;
    private final com.alltimewrapped.backend.repository.TrackRepository trackRepository;
    private final LastFmService lastFmService;
    private final DwDimUserRepository dwDimUserRepository;
    private final DwFactListeningEventRepository dwFactListeningEventRepository;
    private final JdbcTemplate jdbcTemplate;

    private static final double MS_TO_HOURS = 3_600_000.0;
    private static final int TOP_ITEMS_LIMIT = 10;

    // Check if the user has facts in the Data Warehouse
    private boolean isUserInWarehouse(Long userId) {
        String sql = "SELECT EXISTS(SELECT 1 FROM dw.dw_dim_user u JOIN dw.dw_fact_listening_event f ON u.user_key = f.user_key WHERE u.original_user_id = ? LIMIT 1)";
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(sql, Boolean.class, userId));
    }

    // builds the main statistics response for one user
    @Transactional(readOnly = true)
    @Cacheable("userStats")
    public UserStatsResponse getUserStats(Long userId, LocalDate from, LocalDate to) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "User not found with id: " + userId
            );
        }

        validateDateRange(from, to);

        boolean inWarehouse = isUserInWarehouse(userId);

        if (from == null && to == null) {
            return inWarehouse ? buildAllTimeStatsFromWarehouse(userId) : buildAllTimeStats(userId);
        }

        OffsetDateTime fromDateTime = from.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime toDateTimeExclusive = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        return inWarehouse 
                ? buildFilteredStatsFromWarehouse(userId, fromDateTime, toDateTimeExclusive)
                : buildFilteredStats(userId, fromDateTime, toDateTimeExclusive);
    }

    // builds daily listening activity for the heatmap
    @Transactional(readOnly = true)
    @Cacheable("dailyActivity")
    public List<DailyActivityDTO> getDailyActivity(Long userId, LocalDate from, LocalDate to) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "User not found with id: " + userId
            );
        }

        LocalDate today = LocalDate.now();

        LocalDate startDate = from != null
                ? from
                : today.minusYears(1);

        LocalDate endDate = to != null
                ? to
                : today;

        validateDateRange(startDate, endDate);

        if (isUserInWarehouse(userId)) {
            return getDailyActivityFromWarehouse(userId, startDate, endDate);
        }

        OffsetDateTime fromDateTime = startDate.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime toDateTimeExclusive = endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        return listeningRecordRepository.findDailyActivityByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getUserGenreStats(Long userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        if (isUserInWarehouse(userId)) {
            return getUserGenreStatsFromWarehouse(userId);
        }

        List<TopArtistStatsDTO> topArtists = listeningRecordRepository.findTopArtistsByUserId(
                userId,
                PageRequest.of(0, 500)
        );

        Map<String, Long> genreCounts = new java.util.HashMap<>();

        for (TopArtistStatsDTO dto : topArtists) {
            Track track = trackRepository
                    .findFirstByArtistName(dto.getArtistName())
                    .orElse(null);

            if (track == null || track.getGenres() == null || track.getGenres().isEmpty()) {
                continue;
            }

            for (Genre genreEntity : track.getGenres()) {
                String genre = genreEntity.getName();

                if (genre == null || genre.isBlank()) {
                    continue;
                }

                genre = genre.trim();

                if (genre.equalsIgnoreCase("unknown") || genre.equalsIgnoreCase("error")) {
                    continue;
                }

                // Multiply by playCount to give weight to genres listened to more often
                genreCounts.put(
                        genre,
                        genreCounts.getOrDefault(genre, 0L) + dto.getPlayCount()
                );
            }
        }

        // Sort by value descending and limit to top 15
        return genreCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(15)
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (e1, e2) -> e1,
                        LinkedHashMap::new
                ));
    }
    @Transactional(readOnly = true)
    public List<String> getRecommendations(Long userId) {
        Map<String, Long> genreStats = getUserGenreStats(userId);
        if (genreStats.isEmpty()) return new ArrayList<>();

        List<String> topGenres = genreStats.keySet().stream().limit(3).toList();
        List<String> recommendations = new ArrayList<>();

        for (String genre : topGenres) {
            List<String> artists = lastFmService.getTopArtistsByTag(genre);
            for (String artist : artists) {
                if (!listeningRecordRepository.existsByUserIdAndTrack_ArtistName(userId, artist)) {
                    recommendations.add(artist);
                }
            }
        }

        return recommendations.stream().distinct().limit(10).toList();
    }

    // builds statistics from the full imported listening history
    private UserStatsResponse buildAllTimeStats(Long userId) {
        long totalPlays = listeningRecordRepository.countByUserId(userId);

        long totalMsPlayed = listeningRecordRepository.getTotalMsPlayedByUserId(userId);

        double totalHoursPlayed = roundToTwoDecimals(totalMsPlayed / MS_TO_HOURS);

        List<TopTrackStatsDTO> top10Tracks = listeningRecordRepository.findTopTracksByUserId(
                userId,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        List<TopArtistStatsDTO> top10Artists = listeningRecordRepository.findTopArtistsByUserId(
                userId,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        // loads the most played albums for the all-time view
        List<TopAlbumStatsDTO> top10Albums = listeningRecordRepository.findTopAlbumsByUserId(
                userId,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        List<ListeningActivityByYearDTO> listeningActivityByYear =
                listeningRecordRepository.findListeningActivityByYear(userId);

        List<ListeningActivityByMonthDTO> listeningActivityByMonth =
                listeningRecordRepository.findListeningActivityByMonth(userId);

        List<TopArtistByYearDTO> allArtistsByYear =
                listeningRecordRepository.findTopArtistsByYear(userId);

        List<TopArtistByYearDTO> topArtistsByYear = keepTopArtistsPerYear(allArtistsByYear);

        return new UserStatsResponse(
                totalPlays,
                totalMsPlayed,
                totalHoursPlayed,
                top10Tracks,
                top10Artists,
                top10Albums,
                listeningActivityByYear,
                listeningActivityByMonth,
                topArtistsByYear
        );
    }

    // builds statistics only for the selected date range
    private UserStatsResponse buildFilteredStats(
            Long userId,
            OffsetDateTime fromDateTime,
            OffsetDateTime toDateTimeExclusive
    ) {
        long totalPlays = listeningRecordRepository.countByUserIdAndPlayedAtGreaterThanEqualAndPlayedAtLessThan(
                userId,
                fromDateTime,
                toDateTimeExclusive
        );

        long totalMsPlayed = listeningRecordRepository.getTotalMsPlayedByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive
        );

        double totalHoursPlayed = roundToTwoDecimals(totalMsPlayed / MS_TO_HOURS);

        List<TopTrackStatsDTO> top10Tracks = listeningRecordRepository.findTopTracksByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        List<TopArtistStatsDTO> top10Artists = listeningRecordRepository.findTopArtistsByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        // loads the most played albums for the selected period
        List<TopAlbumStatsDTO> top10Albums = listeningRecordRepository.findTopAlbumsByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        List<ListeningActivityByYearDTO> listeningActivityByYear =
                listeningRecordRepository.findListeningActivityByYearBetween(
                        userId,
                        fromDateTime,
                        toDateTimeExclusive
                );

        List<ListeningActivityByMonthDTO> listeningActivityByMonth =
                listeningRecordRepository.findListeningActivityByMonthBetween(
                        userId,
                        fromDateTime,
                        toDateTimeExclusive
                );

        List<TopArtistByYearDTO> allArtistsByYear =
                listeningRecordRepository.findTopArtistsByYearBetween(
                        userId,
                        fromDateTime,
                        toDateTimeExclusive
                );

        List<TopArtistByYearDTO> topArtistsByYear = keepTopArtistsPerYear(allArtistsByYear);

        return new UserStatsResponse(
                totalPlays,
                totalMsPlayed,
                totalHoursPlayed,
                top10Tracks,
                top10Artists,
                top10Albums,
                listeningActivityByYear,
                listeningActivityByMonth,
                topArtistsByYear
        );
    }

    // validates the custom period selected by the user
    private void validateDateRange(LocalDate from, LocalDate to) {
        if ((from == null && to != null) || (from != null && to == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Both from and to dates must be provided"
            );
        }

        if (from != null && from.isAfter(to)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The from date cannot be after the to date"
            );
        }
    }

    // keeps only the first top items for each year
    private List<TopArtistByYearDTO> keepTopArtistsPerYear(List<TopArtistByYearDTO> artistsByYear) {
        Map<Integer, List<TopArtistByYearDTO>> artistsGroupedByYear = new LinkedHashMap<>();

        for (TopArtistByYearDTO artistStats : artistsByYear) {
            artistsGroupedByYear
                    .computeIfAbsent(artistStats.getYear(), year -> new ArrayList<>())
                    .add(artistStats);
        }

        List<TopArtistByYearDTO> limitedArtistsByYear = new ArrayList<>();

        for (List<TopArtistByYearDTO> yearlyArtists : artistsGroupedByYear.values()) {
            limitedArtistsByYear.addAll(
                    yearlyArtists.stream()
                            .limit(50) // Return top 50 artists per year
                            .toList()
            );
        }

        return limitedArtistsByYear;
    }

    // keeps dashboard numbers easier to read
    private double roundToTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    // High performance DW All-Time stats builder (Pre-resolves userKey to completely avoid JOINS on user dimension)
    private UserStatsResponse buildAllTimeStatsFromWarehouse(Long userId) {
        Long userKey = jdbcTemplate.queryForObject(
                "SELECT user_key FROM dw.dw_dim_user WHERE original_user_id = ?",
                Long.class, userId
        );

        long totalPlays = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dw.dw_fact_listening_event WHERE user_key = ?",
                Long.class, userKey
        );

        long totalMsPlayed = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(ms_played), 0) FROM dw.dw_fact_listening_event WHERE user_key = ?",
                Long.class, userKey
        );

        double totalHoursPlayed = roundToTwoDecimals(totalMsPlayed / MS_TO_HOURS);

        List<TopTrackStatsDTO> topTracks = jdbcTemplate.query(
                "SELECT t.track_name, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_track t ON f.track_key = t.track_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "WHERE f.user_key = ? " +
                "GROUP BY t.track_name, a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopTrackStatsDTO(
                        rs.getString("track_name"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<TopArtistStatsDTO> topArtists = jdbcTemplate.query(
                "SELECT a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "WHERE f.user_key = ? " +
                "GROUP BY a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopArtistStatsDTO(
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<TopAlbumStatsDTO> topAlbums = jdbcTemplate.query(
                "SELECT al.album_name, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_album al ON f.album_key = al.album_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "WHERE f.user_key = ? AND al.album_name IS NOT NULL AND al.album_name <> 'Unknown Album' " +
                "GROUP BY al.album_name, a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopAlbumStatsDTO(
                        rs.getString("album_name"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<ListeningActivityByYearDTO> activityByYear = jdbcTemplate.query(
                "SELECT d.year, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? " +
                "GROUP BY d.year " +
                "ORDER BY d.year",
                (rs, rowNum) -> new ListeningActivityByYearDTO(
                        rs.getInt("year"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<ListeningActivityByMonthDTO> activityByMonth = jdbcTemplate.query(
                "SELECT d.year, d.month, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? " +
                "GROUP BY d.year, d.month " +
                "ORDER BY d.year, d.month",
                (rs, rowNum) -> new ListeningActivityByMonthDTO(
                        rs.getInt("year"),
                        rs.getInt("month"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<TopArtistByYearDTO> allArtistsByYear = jdbcTemplate.query(
                "SELECT d.year, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "WHERE f.user_key = ? " +
                "GROUP BY d.year, a.artist_name " +
                "ORDER BY d.year DESC, cnt DESC, ms DESC",
                (rs, rowNum) -> new TopArtistByYearDTO(
                        rs.getInt("year"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey
        );

        List<TopArtistByYearDTO> topArtistsByYear = keepTopArtistsPerYear(allArtistsByYear);

        return new UserStatsResponse(
                totalPlays,
                totalMsPlayed,
                totalHoursPlayed,
                topTracks,
                topArtists,
                topAlbums,
                activityByYear,
                activityByMonth,
                topArtistsByYear
        );
    }

    // High performance DW Date-Filtered stats builder (Pre-resolves userKey to completely avoid JOINS on user dimension)
    private UserStatsResponse buildFilteredStatsFromWarehouse(
            Long userId,
            OffsetDateTime fromDateTime,
            OffsetDateTime toDateTimeExclusive
    ) {
        LocalDate fromDate = fromDateTime.toLocalDate();
        LocalDate toDate = toDateTimeExclusive.toLocalDate();

        Long userKey = jdbcTemplate.queryForObject(
                "SELECT user_key FROM dw.dw_dim_user WHERE original_user_id = ?",
                Long.class, userId
        );

        long totalPlays = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ?",
                Long.class, userKey, fromDate, toDate
        );

        long totalMsPlayed = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(ms_played), 0) FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ?",
                Long.class, userKey, fromDate, toDate
        );

        double totalHoursPlayed = roundToTwoDecimals(totalMsPlayed / MS_TO_HOURS);

        List<TopTrackStatsDTO> topTracks = jdbcTemplate.query(
                "SELECT t.track_name, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_track t ON f.track_key = t.track_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY t.track_name, a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopTrackStatsDTO(
                        rs.getString("track_name"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<TopArtistStatsDTO> topArtists = jdbcTemplate.query(
                "SELECT a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopArtistStatsDTO(
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<TopAlbumStatsDTO> topAlbums = jdbcTemplate.query(
                "SELECT al.album_name, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_album al ON f.album_key = al.album_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "  AND al.album_name IS NOT NULL AND al.album_name <> 'Unknown Album' " +
                "GROUP BY al.album_name, a.artist_name " +
                "ORDER BY cnt DESC, ms DESC LIMIT 10",
                (rs, rowNum) -> new TopAlbumStatsDTO(
                        rs.getString("album_name"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<ListeningActivityByYearDTO> activityByYear = jdbcTemplate.query(
                "SELECT d.year, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY d.year " +
                "ORDER BY d.year",
                (rs, rowNum) -> new ListeningActivityByYearDTO(
                        rs.getInt("year"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<ListeningActivityByMonthDTO> activityByMonth = jdbcTemplate.query(
                "SELECT d.year, d.month, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY d.year, d.month " +
                "ORDER BY d.year, d.month",
                (rs, rowNum) -> new ListeningActivityByMonthDTO(
                        rs.getInt("year"),
                        rs.getInt("month"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<TopArtistByYearDTO> allArtistsByYear = jdbcTemplate.query(
                "SELECT d.year, a.artist_name, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY d.year, a.artist_name " +
                "ORDER BY d.year DESC, cnt DESC, ms DESC",
                (rs, rowNum) -> new TopArtistByYearDTO(
                        rs.getInt("year"),
                        rs.getString("artist_name"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, fromDate, toDate
        );

        List<TopArtistByYearDTO> topArtistsByYear = keepTopArtistsPerYear(allArtistsByYear);

        return new UserStatsResponse(
                totalPlays,
                totalMsPlayed,
                totalHoursPlayed,
                topTracks,
                topArtists,
                topAlbums,
                activityByYear,
                activityByMonth,
                topArtistsByYear
        );
    }

    // High performance DW Daily activity query (Pre-resolves userKey to completely avoid JOINS on user dimension)
    private List<DailyActivityDTO> getDailyActivityFromWarehouse(Long userId, LocalDate startDate, LocalDate endDate) {
        Long userKey = jdbcTemplate.queryForObject(
                "SELECT user_key FROM dw.dw_dim_user WHERE original_user_id = ?",
                Long.class, userId
        );

        return jdbcTemplate.query(
                "SELECT d.year, d.month, d.day, COUNT(f.fact_id) AS cnt, COALESCE(SUM(f.ms_played), 0) AS ms " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                "WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date < ? " +
                "GROUP BY d.year, d.month, d.day " +
                "ORDER BY d.year, d.month, d.day",
                (rs, rowNum) -> new DailyActivityDTO(
                        rs.getInt("year"),
                        rs.getInt("month"),
                        rs.getInt("day"),
                        rs.getLong("cnt"),
                        rs.getLong("ms")
                ),
                userKey, startDate, endDate.plusDays(1)
        );
    }

    // High performance DW Genre stats query (direct from mv_top_genres view)
    private Map<String, Long> getUserGenreStatsFromWarehouse(Long userId) {
        return jdbcTemplate.query(
                "SELECT genre_name, total_plays " +
                "FROM dw.mv_top_genres " +
                "WHERE original_user_id = ? " +
                "ORDER BY total_plays DESC " +
                "LIMIT 15",
                rs -> {
                    Map<String, Long> genreCounts = new LinkedHashMap<>();
                    while (rs.next()) {
                        String genre = rs.getString("genre_name");
                        if (genre != null && !genre.isBlank() && !"unknown".equalsIgnoreCase(genre)) {
                            genreCounts.put(genre.trim(), rs.getLong("total_plays"));
                        }
                    }
                    return genreCounts;
                },
                userId
        );
    }

    @Transactional(readOnly = true)
    @Cacheable("periodStats")
    public PeriodStatsDTO getPeriodStats(Long userId, String period, LocalDate anchor, LocalDate customStart, LocalDate customEnd) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId);
        }

        boolean inWarehouse = isUserInWarehouse(userId);
        LocalDate latestDate = getLatestRecordDate(userId);
        LocalDate oldestDate = getOldestRecordDate(userId);

        LocalDate today = anchor != null ? anchor : latestDate;
        LocalDate currentStart, currentEnd, prevStart, prevEnd;
        String periodLabel;

        if ("day".equalsIgnoreCase(period)) {
            currentStart = today;
            currentEnd = today;
            prevStart = today.minusDays(1);
            prevEnd = today.minusDays(1);
            periodLabel = currentEnd.format(java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy", new java.util.Locale("ro", "RO")));
        } else if ("week".equalsIgnoreCase(period)) {
            int dayOfWeek = today.getDayOfWeek().getValue(); // 1 (Mon) - 7 (Sun)
            currentStart = today.minusDays(dayOfWeek - 1);
            currentEnd = currentStart.plusDays(6);
            prevStart = currentStart.minusWeeks(1);
            prevEnd = currentEnd.minusWeeks(1);

            String startLabel = currentStart.format(java.time.format.DateTimeFormatter.ofPattern("d MMM", new java.util.Locale("ro", "RO")));
            String endLabel = currentEnd.format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", new java.util.Locale("ro", "RO")));
            periodLabel = startLabel + " - " + endLabel;
        } else if ("month".equalsIgnoreCase(period)) {
            currentStart = today.withDayOfMonth(1);
            currentEnd = today.withDayOfMonth(today.lengthOfMonth());
            prevStart = currentStart.minusMonths(1);
            prevEnd = prevStart.withDayOfMonth(prevStart.lengthOfMonth());
            periodLabel = currentEnd.format(java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", new java.util.Locale("ro", "RO")));
        } else if ("year".equalsIgnoreCase(period)) {
            currentStart = today.withDayOfYear(1);
            currentEnd = today.withMonth(12).withDayOfMonth(31);
            prevStart = currentStart.minusYears(1);
            prevEnd = prevStart.withMonth(12).withDayOfMonth(31);
            periodLabel = "Anul " + currentEnd.getYear();
        } else if ("custom".equalsIgnoreCase(period)) {
            currentStart = customStart != null ? customStart : today.minusDays(30);
            currentEnd = customEnd != null ? customEnd : today;
            long days = java.time.temporal.ChronoUnit.DAYS.between(currentStart, currentEnd);
            prevEnd = currentStart.minusDays(1);
            prevStart = prevEnd.minusDays(days);

            String startLabel = currentStart.format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", new java.util.Locale("ro", "RO")));
            String endLabel = currentEnd.format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", new java.util.Locale("ro", "RO")));
            periodLabel = startLabel + " - " + endLabel;
        } else {
            // lifetime
            currentStart = oldestDate;
            currentEnd = latestDate;
            prevStart = oldestDate;
            prevEnd = oldestDate;
            periodLabel = "Lifetime";
        }

        PeriodStatsDTO.Metrics currentMetrics;
        PeriodStatsDTO.Metrics prevMetrics;
        List<Long> hourlyPlays = new ArrayList<>(java.util.Collections.nCopies(24, 0L));
        List<Double> hourlyMinutes = new ArrayList<>(java.util.Collections.nCopies(24, 0.0));
        List<Long> weekdayPlays = new ArrayList<>(java.util.Collections.nCopies(7, 0L));
        List<Integer> availableYears;

        if (inWarehouse) {
            Long userKey = jdbcTemplate.queryForObject(
                    "SELECT user_key FROM dw.dw_dim_user WHERE original_user_id = ?",
                    Long.class, userId
            );

            currentMetrics = getMetricsFromWarehouse(userKey, currentStart, currentEnd);
            prevMetrics = getMetricsFromWarehouse(userKey, prevStart, prevEnd);

            // Populate hourly activity
            String sqlHourly = """
                SELECT 
                  t.hour,
                  COUNT(f.fact_id) AS streams,
                  COALESCE(SUM(f.ms_played), 0) / 60000.0 AS minutes
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                JOIN dw.dw_dim_time t ON f.time_key = t.time_key
                WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date <= ?
                GROUP BY t.hour
                """;
            jdbcTemplate.query(sqlHourly, rs -> {
                int h = rs.getInt("hour");
                if (h >= 0 && h < 24) {
                    hourlyPlays.set(h, rs.getLong("streams"));
                    hourlyMinutes.set(h, rs.getDouble("minutes"));
                }
            }, userKey, currentStart, currentEnd);

            // Populate weekday plays (extracting ISODOW: 1=Mon ... 7=Sun)
            String sqlWeekday = """
                SELECT 
                  CAST(EXTRACT(ISODOW FROM d.full_date) AS INTEGER) AS dow,
                  COUNT(f.fact_id) AS streams
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date <= ?
                GROUP BY dow
                """;
            jdbcTemplate.query(sqlWeekday, rs -> {
                int dow = rs.getInt("dow");
                int index = dow == 7 ? 6 : dow - 1; // Map Sunday to 6, Monday to 0
                if (index >= 0 && index < 7) {
                    weekdayPlays.set(index, rs.getLong("streams"));
                }
            }, userKey, currentStart, currentEnd);

            // Populate available years
            availableYears = jdbcTemplate.query(
                    "SELECT DISTINCT CAST(d.year AS INTEGER) AS yr " +
                    "FROM dw.dw_fact_listening_event f " +
                    "JOIN dw.dw_dim_date d ON f.date_key = d.date_key " +
                    "WHERE f.user_key = ? " +
                    "ORDER BY yr DESC",
                    (rs, rowNum) -> rs.getInt("yr"),
                    userKey
            );
        } else {
            currentMetrics = getMetricsFromOltp(userId, currentStart, currentEnd);
            prevMetrics = getMetricsFromOltp(userId, prevStart, prevEnd);

            // Populate hourly activity from OLTP
            OffsetDateTime currentStartDt = currentStart.atStartOfDay().atOffset(ZoneOffset.UTC);
            OffsetDateTime currentEndDt = currentEnd.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1);

            String sqlHourly = """
                SELECT 
                  CAST(EXTRACT(HOUR FROM r.played_at) AS INTEGER) AS hr,
                  COUNT(r.id) AS streams,
                  COALESCE(SUM(r.ms_played), 0) / 60000.0 AS minutes
                FROM oltp.listening_records r
                WHERE r.user_id = ? AND r.played_at >= ? AND r.played_at <= ?
                GROUP BY hr
                """;
            jdbcTemplate.query(sqlHourly, rs -> {
                int h = rs.getInt("hr");
                if (h >= 0 && h < 24) {
                    hourlyPlays.set(h, rs.getLong("streams"));
                    hourlyMinutes.set(h, rs.getDouble("minutes"));
                }
            }, userId, currentStartDt, currentEndDt);

            // Populate weekday plays from OLTP
            String sqlWeekday = """
                SELECT 
                  CAST(EXTRACT(ISODOW FROM r.played_at) AS INTEGER) AS dow,
                  COUNT(r.id) AS streams
                FROM oltp.listening_records r
                WHERE r.user_id = ? AND r.played_at >= ? AND r.played_at <= ?
                GROUP BY dow
                """;
            jdbcTemplate.query(sqlWeekday, rs -> {
                int dow = rs.getInt("dow");
                int index = dow == 7 ? 6 : dow - 1; // Map Sunday to 6, Monday to 0
                if (index >= 0 && index < 7) {
                    weekdayPlays.set(index, rs.getLong("streams"));
                }
            }, userId, currentStartDt, currentEndDt);

            // Populate available years from OLTP
            availableYears = jdbcTemplate.query(
                    "SELECT DISTINCT CAST(EXTRACT(YEAR FROM r.played_at) AS INTEGER) AS yr " +
                    "FROM oltp.listening_records r " +
                    "WHERE r.user_id = ? " +
                    "ORDER BY yr DESC",
                    (rs, rowNum) -> rs.getInt("yr"),
                    userId
            );
        }

        if (availableYears.isEmpty()) {
            availableYears = List.of(LocalDate.now().getYear());
        }

        // Calculate trends
        boolean isLifetime = "lifetime".equalsIgnoreCase(period);
        PeriodStatsDTO.Trends trends = PeriodStatsDTO.Trends.builder()
                .streams(isLifetime ? null : calculateTrendPercent(currentMetrics.getStreams(), prevMetrics.getStreams()))
                .uniqueTracks(isLifetime ? null : calculateTrendPercent(currentMetrics.getUniqueTracks(), prevMetrics.getUniqueTracks()))
                .minutes(isLifetime ? null : calculateTrendPercent(currentMetrics.getMinutes(), prevMetrics.getMinutes()))
                .uniqueArtists(isLifetime ? null : calculateTrendPercent(currentMetrics.getUniqueArtists(), prevMetrics.getUniqueArtists()))
                .hours(isLifetime ? null : calculateTrendPercent(currentMetrics.getHours(), prevMetrics.getHours()))
                .uniqueAlbums(isLifetime ? null : calculateTrendPercent(currentMetrics.getUniqueAlbums(), prevMetrics.getUniqueAlbums()))
                .daysCount(isLifetime ? null : calculateTrendPercent(currentMetrics.getDaysCount(), prevMetrics.getDaysCount()))
                .build();

        // Calculate isLatestPeriod and isOldestPeriod
        boolean isLatest = true;
        boolean isOldest = true;

        if (!"lifetime".equalsIgnoreCase(period) && !"custom".equalsIgnoreCase(period)) {
            if ("day".equalsIgnoreCase(period)) {
                isLatest = today.isEqual(latestDate) || today.isAfter(latestDate);
                isOldest = today.isEqual(oldestDate) || today.isBefore(oldestDate);
            } else if ("week".equalsIgnoreCase(period)) {
                LocalDate currentMon = currentStart;
                LocalDate latestMon = latestDate.minusDays(latestDate.getDayOfWeek().getValue() - 1);
                LocalDate oldestMon = oldestDate.minusDays(oldestDate.getDayOfWeek().getValue() - 1);
                isLatest = currentMon.isEqual(latestMon) || currentMon.isAfter(latestMon);
                isOldest = currentMon.isEqual(oldestMon) || currentMon.isBefore(oldestMon);
            } else if ("month".equalsIgnoreCase(period)) {
                LocalDate currentMon = currentStart;
                LocalDate latestMon = latestDate.withDayOfMonth(1);
                LocalDate oldestMon = oldestDate.withDayOfMonth(1);
                isLatest = currentMon.isEqual(latestMon) || currentMon.isAfter(latestMon);
                isOldest = currentMon.isEqual(oldestMon) || currentMon.isBefore(oldestMon);
            } else if ("year".equalsIgnoreCase(period)) {
                isLatest = currentStart.getYear() >= latestDate.getYear();
                isOldest = currentStart.getYear() <= oldestDate.getYear();
            }
        }

        return PeriodStatsDTO.builder()
                .current(currentMetrics)
                .trends(trends)
                .periodLabel(periodLabel)
                .hourlyPlays(hourlyPlays)
                .hourlyMinutes(hourlyMinutes)
                .weekdayPlays(weekdayPlays)
                .availableYears(availableYears)
                .isLatestPeriod(isLatest)
                .isOldestPeriod(isOldest)
                .anchorDate(today)
                .build();
    }

    private LocalDate getLatestRecordDate(Long userId) {
        try {
            String sql = "SELECT MAX(played_at) FROM oltp.listening_records WHERE user_id = ?";
            OffsetDateTime maxTime = jdbcTemplate.queryForObject(sql, OffsetDateTime.class, userId);
            return maxTime != null ? maxTime.toLocalDate() : LocalDate.now();
        } catch (Exception e) {
            return java.time.LocalDate.now();
        }
    }

    private LocalDate getOldestRecordDate(Long userId) {
        try {
            String sql = "SELECT MIN(played_at) FROM oltp.listening_records WHERE user_id = ?";
            OffsetDateTime minTime = jdbcTemplate.queryForObject(sql, OffsetDateTime.class, userId);
            return minTime != null ? minTime.toLocalDate() : LocalDate.now().minusYears(1);
        } catch (Exception e) {
            return java.time.LocalDate.now().minusYears(1);
        }
    }

    private Double calculateTrendPercent(double curr, double prev) {
        if (prev == 0) {
            return curr > 0 ? 100.0 : 0.0;
        }
        return ((curr - prev) / prev) * 100.0;
    }

    private PeriodStatsDTO.Metrics getMetricsFromWarehouse(Long userKey, LocalDate start, LocalDate end) {
        String sql = """
            SELECT 
              COUNT(f.fact_id) AS streams,
              COUNT(DISTINCT f.track_key) AS unique_tracks,
              COALESCE(SUM(f.ms_played), 0) / 60000.0 AS minutes,
              COUNT(DISTINCT f.artist_key) AS unique_artists,
              COALESCE(SUM(f.ms_played), 0) / 3600000.0 AS hours,
              COUNT(DISTINCT CASE WHEN al.album_name IS NOT NULL AND al.album_name <> '' AND al.album_name <> 'Unknown Album' THEN al.album_name END) AS unique_albums,
              COUNT(DISTINCT d.full_date) AS days_count
            FROM dw.dw_fact_listening_event f
            JOIN dw.dw_dim_date d ON f.date_key = d.date_key
            JOIN dw.dw_dim_album al ON f.album_key = al.album_key
            WHERE f.user_key = ? AND d.full_date >= ? AND d.full_date <= ?
            """;
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new PeriodStatsDTO.Metrics(
                rs.getLong("streams"),
                rs.getLong("unique_tracks"),
                roundToTwoDecimals(rs.getDouble("minutes")),
                rs.getLong("unique_artists"),
                roundToTwoDecimals(rs.getDouble("hours")),
                rs.getLong("unique_albums"),
                rs.getLong("days_count")
        ), userKey, start, end);
    }

    private PeriodStatsDTO.Metrics getMetricsFromOltp(Long userId, LocalDate start, LocalDate end) {
        OffsetDateTime startDt = start.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime endDt = end.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1);
        
        String sql = """
            SELECT 
              COUNT(r.id) AS streams,
              COUNT(DISTINCT r.track_id) AS unique_tracks,
              COALESCE(SUM(r.ms_played), 0) / 60000.0 AS minutes,
              COUNT(DISTINCT t.artist_name) AS unique_artists,
              COALESCE(SUM(r.ms_played), 0) / 3600000.0 AS hours,
              COUNT(DISTINCT CASE WHEN t.album_name IS NOT NULL AND t.album_name <> '' AND t.album_name <> 'Unknown Album' THEN t.album_name END) AS unique_albums,
              COUNT(DISTINCT DATE(r.played_at)) AS days_count
            FROM oltp.listening_records r
            JOIN oltp.tracks t ON r.track_id = t.id
            WHERE r.user_id = ? AND r.played_at >= ? AND r.played_at <= ?
            """;
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> new PeriodStatsDTO.Metrics(
                rs.getLong("streams"),
                rs.getLong("unique_tracks"),
                roundToTwoDecimals(rs.getDouble("minutes")),
                rs.getLong("unique_artists"),
                roundToTwoDecimals(rs.getDouble("hours")),
                rs.getLong("unique_albums"),
                rs.getLong("days_count")
        ), userId, startDt, endDt);
    }
}