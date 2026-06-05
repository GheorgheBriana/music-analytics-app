package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.analytics.model.*;
import com.alltimewrapped.backend.analytics.repository.*;
import com.alltimewrapped.backend.model.*;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsRefreshService {

    private static final long UNKNOWN_ARTIST_ID = -1L;
    private static final long UNKNOWN_ALBUM_ID = -1L;
    private static final long UNKNOWN_GENRE_ID = -1L;

    private final ListeningRecordRepository listeningRecordRepository;

    private final DwDimUserRepository dwDimUserRepository;
    private final DwDimTrackRepository dwDimTrackRepository;
    private final DwDimArtistRepository dwDimArtistRepository;
    private final DwDimAlbumRepository dwDimAlbumRepository;
    private final DwDimGenreRepository dwDimGenreRepository;
    private final DwDimDateRepository dwDimDateRepository;
    private final DwDimTimeRepository dwDimTimeRepository;
    private final DwDimPlatformRepository dwDimPlatformRepository;
    private final DwDimSourceRepository dwDimSourceRepository;
    private final DwFactListeningEventRepository dwFactListeningEventRepository;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public Map<String, Object> refreshWarehouse(int limit) {
        return processRecordsIntoWarehouseFast(null, limit);
    }

    @Transactional
    public Map<String, Object> refreshWarehouseForUser(Long userId, int limit) {
        return processRecordsIntoWarehouseFast(userId, limit);
    }

    private Map<String, Object> processRecordsIntoWarehouse(List<ListeningRecord> records, int limit) {
        log.info("[DW REFRESH] Processing {} records into DW dimensions & facts...", records.size());
        long startProcessing = System.currentTimeMillis();

        int processedRecords = 0;
        int insertedFacts = 0;
        int skippedInvalidRecords = 0;
        int recordsWithFallbackDimensions = 0;

        List<DwFactListeningEvent> factBatch = new ArrayList<>();
        final int FACT_BATCH_SIZE = 500;

        Map<String, DwDimUser> userCache = new HashMap<>();
        Map<String, DwDimTrack> trackCache = new HashMap<>();
        Map<String, DwDimArtist> artistCache = new HashMap<>();
        Map<String, DwDimAlbum> albumCache = new HashMap<>();
        Map<String, DwDimGenre> genreCache = new HashMap<>();
        Map<String, DwDimDate> dateCache = new HashMap<>();
        Map<String, DwDimTime> timeCache = new HashMap<>();
        Map<String, DwDimPlatform> platformCache = new HashMap<>();
        Map<String, DwDimSource> sourceCache = new HashMap<>();

        long userSyncTime = 0;
        long trackSyncTime = 0;
        long artistSyncTime = 0;
        long albumSyncTime = 0;
        long genreSyncTime = 0;
        long dateSyncTime = 0;
        long timeSyncTime = 0;
        long platformSyncTime = 0;
        long sourceSyncTime = 0;
        long factInsertTime = 0;

        for (ListeningRecord record : records) {
            processedRecords++;

            if (record.getId() == null
                    || record.getUser() == null
                    || record.getTrack() == null
                    || record.getPlayedAt() == null) {
                skippedInvalidRecords++;
                continue;
            }

            Track track = record.getTrack();

            Artist primaryArtist = getPrimaryArtist(track);
            Album album = track.getAlbum();
            Genre primaryGenre = getPrimaryGenre(track);

            if (primaryArtist == null || album == null || primaryGenre == null) {
                recordsWithFallbackDimensions++;
            }

            long t0 = System.nanoTime();
            DwDimUser userDim = findOrCreateUser(record.getUser(), userCache);
            long t1 = System.nanoTime();
            userSyncTime += (t1 - t0);

            DwDimTrack trackDim = findOrCreateTrack(track, trackCache);
            long t2 = System.nanoTime();
            trackSyncTime += (t2 - t1);

            DwDimArtist artistDim = findOrCreateArtist(primaryArtist, artistCache);
            long t3 = System.nanoTime();
            artistSyncTime += (t3 - t2);

            DwDimAlbum albumDim = findOrCreateAlbum(album, albumCache);
            long t4 = System.nanoTime();
            albumSyncTime += (t4 - t3);

            DwDimGenre genreDim = findOrCreateGenre(primaryGenre, genreCache);
            long t5 = System.nanoTime();
            genreSyncTime += (t5 - t4);

            DwDimDate dateDim = findOrCreateDate(record.getPlayedAt(), dateCache);
            long t6 = System.nanoTime();
            dateSyncTime += (t6 - t5);

            DwDimTime timeDim = findOrCreateTime(record.getPlayedAt(), timeCache);
            long t7 = System.nanoTime();
            timeSyncTime += (t7 - t6);

            DwDimPlatform platformDim = findOrCreatePlatform(record.getPlatform(), platformCache);
            long t8 = System.nanoTime();
            platformSyncTime += (t8 - t7);

            DwDimSource sourceDim = findOrCreateSource(record.getSource(), sourceCache);
            long t9 = System.nanoTime();
            sourceSyncTime += (t9 - t8);

            Long msPlayed = record.getMsPlayed() != null ? record.getMsPlayed() : 0L;
            Double minutesPlayed = msPlayed / 60000.0;
            Double completionRate = calculateCompletionRate(msPlayed, track.getDurationMs());

            DwFactListeningEvent fact = DwFactListeningEvent.builder()
                    .originalListeningRecordId(record.getId())
                    .user(userDim)
                    .track(trackDim)
                    .artist(artistDim)
                    .album(albumDim)
                    .genre(genreDim)
                    .date(dateDim)
                    .time(timeDim)
                    .platform(platformDim)
                    .source(sourceDim)
                    .msPlayed(msPlayed)
                    .minutesPlayed(minutesPlayed)
                    .playCount(1)
                    .skipped(record.getSkipped())
                    .completionRate(completionRate)
                    .build();

            factBatch.add(fact);
            insertedFacts++;

            if (factBatch.size() >= FACT_BATCH_SIZE) {
                log.info("[DW REFRESH] Saving batch of {} facts...", factBatch.size());
                long fStart = System.currentTimeMillis();
                saveFactBatch(factBatch);
                factInsertTime += (System.currentTimeMillis() - fStart);
            }
        }

        // flush remaining facts
        if (!factBatch.isEmpty()) {
            log.info("[DW REFRESH] Saving final batch of {} facts...", factBatch.size());
            long fStart = System.currentTimeMillis();
            saveFactBatch(factBatch);
            factInsertTime += (System.currentTimeMillis() - fStart);
        }

        long totalProcTime = System.currentTimeMillis() - startProcessing;
        log.info("[DW REFRESH] Dimension User sync finished. Total time: {} ms", String.format("%.2f", userSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Track sync finished. Total time: {} ms", String.format("%.2f", trackSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Artist sync finished. Total time: {} ms", String.format("%.2f", artistSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Album sync finished. Total time: {} ms", String.format("%.2f", albumSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Genre sync finished. Total time: {} ms", String.format("%.2f", genreSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Date sync finished. Total time: {} ms", String.format("%.2f", dateSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Time sync finished. Total time: {} ms", String.format("%.2f", timeSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Platform sync finished. Total time: {} ms", String.format("%.2f", platformSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Dimension Source sync finished. Total time: {} ms", String.format("%.2f", sourceSyncTime / 1_000_000.0));
        log.info("[DW REFRESH] Fact insert finished. Total time: {} ms", factInsertTime);
        log.info("[DW REFRESH] Completed processRecordsIntoWarehouse for {} records in {} ms", records.size(), totalProcTime);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Data Warehouse refresh batch completed successfully");
        result.put("limit", limit);
        result.put("processedRecords", processedRecords);
        result.put("insertedFacts", insertedFacts);
        result.put("skippedInvalidRecords", skippedInvalidRecords);
        result.put("recordsWithFallbackDimensions", recordsWithFallbackDimensions);
        result.put("totalFacts", dwFactListeningEventRepository.count());

        return result;
    }

    private DwDimUser findOrCreateUser(AppUser user, Map<String, DwDimUser> cache) {
        String key = String.valueOf(user.getId());
        if (cache.containsKey(key)) return cache.get(key);

        DwDimUser dim = dwDimUserRepository.findByOriginalUserId(user.getId())
                .orElseGet(() -> dwDimUserRepository.save(
                        DwDimUser.builder()
                                .originalUserId(user.getId())
                                .username(normalize(user.getUsername(), "unknown_user"))
                                .email(user.getEmail())
                                .country(null)
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimTrack findOrCreateTrack(Track track, Map<String, DwDimTrack> cache) {
        String key = String.valueOf(track.getId());
        if (cache.containsKey(key)) return cache.get(key);

        DwDimTrack dim = dwDimTrackRepository.findByOriginalTrackId(track.getId())
                .orElseGet(() -> dwDimTrackRepository.save(
                        DwDimTrack.builder()
                                .originalTrackId(track.getId())
                                .spotifyTrackUri(track.getSpotifyTrackUri())
                                .trackName(normalize(track.getTrackName(), "Unknown Track"))
                                .durationMs(track.getDurationMs())
                                .imageUrl(track.getImageUrl())
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimArtist findOrCreateArtist(Artist artist, Map<String, DwDimArtist> cache) {
        if (artist == null || artist.getId() == null) {
            return findOrCreateUnknownArtist(cache);
        }

        String key = String.valueOf(artist.getId());
        if (cache.containsKey(key)) return cache.get(key);

        DwDimArtist dim = dwDimArtistRepository.findByOriginalArtistId(artist.getId())
                .orElseGet(() -> dwDimArtistRepository.save(
                        DwDimArtist.builder()
                                .originalArtistId(artist.getId())
                                .artistName(normalize(artist.getArtistName(), "Unknown Artist"))
                                .spotifyArtistUri(artist.getSpotifyArtistUri())
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimArtist findOrCreateUnknownArtist(Map<String, DwDimArtist> cache) {
        String key = String.valueOf(UNKNOWN_ARTIST_ID);
        if (cache.containsKey(key)) return cache.get(key);

        DwDimArtist dim = dwDimArtistRepository.findByOriginalArtistId(UNKNOWN_ARTIST_ID)
                .orElseGet(() -> dwDimArtistRepository.save(
                        DwDimArtist.builder()
                                .originalArtistId(UNKNOWN_ARTIST_ID)
                                .artistName("Unknown Artist")
                                .spotifyArtistUri(null)
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimAlbum findOrCreateAlbum(Album album, Map<String, DwDimAlbum> cache) {
        if (album == null || album.getId() == null) {
            return findOrCreateUnknownAlbum(cache);
        }

        String key = String.valueOf(album.getId());
        if (cache.containsKey(key)) return cache.get(key);

        DwDimAlbum dim = dwDimAlbumRepository.findByOriginalAlbumId(album.getId())
                .orElseGet(() -> dwDimAlbumRepository.save(
                        DwDimAlbum.builder()
                                .originalAlbumId(album.getId())
                                .albumName(normalize(album.getAlbumName(), "Unknown Album"))
                                .releaseYear(album.getReleaseDate() != null ? album.getReleaseDate().getYear() : null)
                                .albumType(album.getAlbumType())
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimAlbum findOrCreateUnknownAlbum(Map<String, DwDimAlbum> cache) {
        String key = String.valueOf(UNKNOWN_ALBUM_ID);
        if (cache.containsKey(key)) return cache.get(key);

        DwDimAlbum dim = dwDimAlbumRepository.findByOriginalAlbumId(UNKNOWN_ALBUM_ID)
                .orElseGet(() -> dwDimAlbumRepository.save(
                        DwDimAlbum.builder()
                                .originalAlbumId(UNKNOWN_ALBUM_ID)
                                .albumName("Unknown Album")
                                .releaseYear(null)
                                .albumType(null)
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimGenre findOrCreateGenre(Genre genre, Map<String, DwDimGenre> cache) {
        if (genre == null || genre.getId() == null) {
            return findOrCreateUnknownGenre(cache);
        }

        String key = String.valueOf(genre.getId());
        if (cache.containsKey(key)) return cache.get(key);

        DwDimGenre dim = dwDimGenreRepository.findByOriginalGenreId(genre.getId())
                .orElseGet(() -> dwDimGenreRepository.save(
                        DwDimGenre.builder()
                                .originalGenreId(genre.getId())
                                .genreName(normalize(genre.getName(), "unknown"))
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimGenre findOrCreateUnknownGenre(Map<String, DwDimGenre> cache) {
        String key = String.valueOf(UNKNOWN_GENRE_ID);
        if (cache.containsKey(key)) return cache.get(key);

        DwDimGenre dim = dwDimGenreRepository.findByOriginalGenreId(UNKNOWN_GENRE_ID)
                .orElseGet(() -> dwDimGenreRepository.save(
                        DwDimGenre.builder()
                                .originalGenreId(UNKNOWN_GENRE_ID)
                                .genreName("unknown")
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimDate findOrCreateDate(OffsetDateTime playedAt, Map<String, DwDimDate> cache) {
        LocalDate fullDate = playedAt.toLocalDate();
        String key = fullDate.toString();
        if (cache.containsKey(key)) return cache.get(key);

        DwDimDate dim = dwDimDateRepository.findByFullDate(fullDate)
                .orElseGet(() -> {
                    int month = fullDate.getMonthValue();
                    int year = fullDate.getYear();
                    int day = fullDate.getDayOfMonth();
                    Long smartDateKey = (long) (year * 10000 + month * 100 + day);

                    return dwDimDateRepository.save(
                            DwDimDate.builder()
                                    .dateKey(smartDateKey)
                                    .fullDate(fullDate)
                                    .day(day)
                                    .month(month)
                                    .monthName(fullDate.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH))
                                    .quarter(((month - 1) / 3) + 1)
                                    .year(year)
                                    .dayOfWeek(fullDate.getDayOfWeek().getValue())
                                    .dayName(fullDate.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH))
                                    .isWeekend(fullDate.getDayOfWeek().getValue() >= 6)
                                    .build()
                    );
                });
        cache.put(key, dim);
        return dim;
    }

    private DwDimTime findOrCreateTime(OffsetDateTime playedAt, Map<String, DwDimTime> cache) {
        int hour = playedAt.getHour();
        int minute = playedAt.getMinute();
        String key = hour + ":" + minute;
        if (cache.containsKey(key)) return cache.get(key);

        DwDimTime dim = dwDimTimeRepository.findByHourAndMinute(hour, minute)
                .orElseGet(() -> dwDimTimeRepository.save(
                        DwDimTime.builder()
                                .hour(hour)
                                .minute(minute)
                                .partOfDay(resolvePartOfDay(hour))
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimPlatform findOrCreatePlatform(String platform, Map<String, DwDimPlatform> cache) {
        String platformName = normalize(platform, "unknown");
        String key = platformName.toLowerCase();
        if (cache.containsKey(key)) return cache.get(key);

        DwDimPlatform dim = dwDimPlatformRepository.findByPlatformNameIgnoreCase(platformName)
                .orElseGet(() -> dwDimPlatformRepository.save(
                        DwDimPlatform.builder()
                                .platformName(platformName)
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private DwDimSource findOrCreateSource(ListeningSource source, Map<String, DwDimSource> cache) {
        String sourceName = source != null ? source.name() : "unknown";
        String key = sourceName.toLowerCase();
        if (cache.containsKey(key)) return cache.get(key);

        DwDimSource dim = dwDimSourceRepository.findBySourceNameIgnoreCase(sourceName)
                .orElseGet(() -> dwDimSourceRepository.save(
                        DwDimSource.builder()
                                .sourceName(sourceName)
                                .build()
                ));
        cache.put(key, dim);
        return dim;
    }

    private Artist getPrimaryArtist(Track track) {
        if (track.getArtists() == null || track.getArtists().isEmpty()) {
            return null;
        }

        return track.getArtists().iterator().next();
    }

    private Genre getPrimaryGenre(Track track) {
        if (track.getGenres() == null || track.getGenres().isEmpty()) {
            return null;
        }

        return track.getGenres().iterator().next();
    }

    private Double calculateCompletionRate(Long msPlayed, Long durationMs) {
        if (msPlayed == null) {
            return null;
        }

        long duration = (durationMs != null && durationMs > 0) ? durationMs : 200000L; // Fallback to 200k ms (3m 20s)
        double rate = msPlayed.doubleValue() / (double) duration;
        return Math.min(rate, 1.0);
    }

    private String resolvePartOfDay(int hour) {
        if (hour >= 5 && hour < 12) {
            return "morning";
        }

        if (hour >= 12 && hour < 17) {
            return "afternoon";
        }

        if (hour >= 17 && hour < 22) {
            return "evening";
        }

        return "night";
    }

    private void saveFactBatch(List<DwFactListeningEvent> factBatch) {
        String sql = """
            INSERT INTO dw.dw_fact_listening_event 
            (original_listening_record_id, user_key, track_key, artist_key, album_key, genre_key, date_key, time_key, platform_key, source_key, ms_played, minutes_played, play_count, skipped, completion_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                DwFactListeningEvent f = factBatch.get(i);
                ps.setLong(1, f.getOriginalListeningRecordId());
                ps.setLong(2, f.getUser().getUserKey());
                ps.setLong(3, f.getTrack().getTrackKey());
                ps.setLong(4, f.getArtist().getArtistKey());
                ps.setLong(5, f.getAlbum().getAlbumKey());
                ps.setLong(6, f.getGenre().getGenreKey());
                ps.setLong(7, f.getDate().getDateKey());
                ps.setLong(8, f.getTime().getTimeKey());
                ps.setLong(9, f.getPlatform().getPlatformKey());
                ps.setLong(10, f.getSource().getSourceKey());
                ps.setLong(11, f.getMsPlayed());
                ps.setDouble(12, f.getMinutesPlayed());
                ps.setInt(13, f.getPlayCount());

                if (f.getSkipped() != null) {
                    ps.setBoolean(14, f.getSkipped());
                } else {
                    ps.setNull(14, Types.BOOLEAN);
                }

                if (f.getCompletionRate() != null) {
                    ps.setDouble(15, f.getCompletionRate());
                } else {
                    ps.setNull(15, Types.DOUBLE);
                }
            }

            @Override
            public int getBatchSize() {
                return factBatch.size();
            }
        });

        log.debug("Bulk inserted batch of {} facts into DW via JDBC", factBatch.size());
        factBatch.clear();
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }

    /**
     * Fast OLTP -> DW sync.
     *
     * The previous implementation loaded OLTP rows as JPA entities and then resolved every DW
     * dimension through repository calls. Even with a small in-memory cache, this still produced
     * many small SELECT/INSERT operations and many lazy relation loads.
     *
     * This implementation keeps the ETL work inside PostgreSQL:
     * 1. save the pending OLTP ids in a temporary table;
     * 2. insert missing dimension rows with INSERT ... SELECT DISTINCT;
     * 3. insert the fact rows with one INSERT ... SELECT and joins to dimensions.
     */
    private Map<String, Object> processRecordsIntoWarehouseFast(Long userId, int limit) {
        long startedAt = System.currentTimeMillis();
        int safeLimit = Math.max(1, limit);

        String trackArtistsTable = resolveRelationTable("oltp.track_artists", "track_artists");
        String trackGenresTable = resolveRelationTable("oltp.track_genres", "track_genres");

        jdbcTemplate.execute("DROP TABLE IF EXISTS tmp_dw_pending_records");

        if (userId == null) {
            jdbcTemplate.update("""
                    CREATE TEMP TABLE tmp_dw_pending_records ON COMMIT DROP AS
                    SELECT lr.id
                    FROM oltp.listening_records lr
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM dw.dw_fact_listening_event f
                        WHERE f.original_listening_record_id = lr.id
                    )
                    ORDER BY lr.id
                    LIMIT ?
                    """, safeLimit);
        } else {
            jdbcTemplate.update("""
                    CREATE TEMP TABLE tmp_dw_pending_records ON COMMIT DROP AS
                    SELECT lr.id
                    FROM oltp.listening_records lr
                    WHERE lr.user_id = ?
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dw.dw_fact_listening_event f
                          WHERE f.original_listening_record_id = lr.id
                      )
                    ORDER BY lr.id
                    LIMIT ?
                    """, userId, safeLimit);
        }

        jdbcTemplate.execute("CREATE INDEX idx_tmp_dw_pending_records_id ON tmp_dw_pending_records(id)");

        Integer pendingRecords = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tmp_dw_pending_records",
                Integer.class
        );

        if (pendingRecords == null || pendingRecords == 0) {
            Map<String, Object> emptyResult = new LinkedHashMap<>();
            emptyResult.put("message", "No new OLTP records found for Data Warehouse refresh");
            emptyResult.put("limit", safeLimit);
            emptyResult.put("processedRecords", 0);
            emptyResult.put("insertedFacts", 0);
            emptyResult.put("skippedInvalidRecords", 0);
            emptyResult.put("recordsWithFallbackDimensions", 0);
            emptyResult.put("totalFacts", dwFactListeningEventRepository.count());
            emptyResult.put("durationMs", System.currentTimeMillis() - startedAt);
            emptyResult.put("mode", "FAST_SQL");
            return emptyResult;
        }

        log.info("[DW FAST REFRESH] Starting set-based sync for {} pending records, userId={}", pendingRecords, userId);

        int insertedUnknownDimensions = insertUnknownDimensions();
        int insertedUsers = insertUserDimensions();
        int insertedTracks = insertTrackDimensions();
        int insertedArtists = insertArtistDimensions(trackArtistsTable);
        int insertedAlbums = insertAlbumDimensions();
        int insertedGenres = insertGenreDimensions(trackGenresTable);
        int insertedDates = insertDateDimensions();
        int insertedTimes = insertTimeDimensions();
        int insertedPlatforms = insertPlatformDimensions();
        int insertedSources = insertSourceDimensions();
        int insertedFacts = insertFactRows(trackArtistsTable, trackGenresTable);
        int resolvedUnknownGenres = resolveUnknownGenresInWarehouse(trackGenresTable);

        long durationMs = System.currentTimeMillis() - startedAt;

        log.info(
                "[DW FAST REFRESH] Completed {} fact inserts from {} pending records in {} ms",
                insertedFacts,
                pendingRecords,
                durationMs
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Data Warehouse fast refresh completed successfully");
        result.put("mode", "FAST_SQL");
        result.put("limit", safeLimit);
        result.put("userId", userId);
        result.put("processedRecords", pendingRecords);
        result.put("insertedFacts", insertedFacts);
        result.put("skippedInvalidRecords", Math.max(0, pendingRecords - insertedFacts));
        result.put("recordsWithFallbackDimensions", countRecordsWithFallbackDimensions(trackArtistsTable, trackGenresTable));
        result.put("insertedUnknownDimensions", insertedUnknownDimensions);
        result.put("insertedUsers", insertedUsers);
        result.put("insertedTracks", insertedTracks);
        result.put("insertedArtists", insertedArtists);
        result.put("insertedAlbums", insertedAlbums);
        result.put("insertedGenres", insertedGenres);
        result.put("insertedDates", insertedDates);
        result.put("insertedTimes", insertedTimes);
        result.put("insertedPlatforms", insertedPlatforms);
        result.put("insertedSources", insertedSources);
        result.put("resolvedUnknownGenres", resolvedUnknownGenres);
        result.put("totalFacts", dwFactListeningEventRepository.count());
        result.put("durationMs", durationMs);

        return result;
    }

    private int resolveUnknownGenresInWarehouse(String trackGenresTable) {
        try {
            Integer unknownGenreKey = jdbcTemplate.queryForObject(
                    "SELECT genre_key FROM dw.dw_dim_genre WHERE LOWER(genre_name) = 'unknown'",
                    Integer.class
            );

            if (unknownGenreKey == null) {
                return 0;
            }

            String sql = """
                WITH unknown_oltp_genre AS (
                    SELECT id
                    FROM oltp.genres
                    WHERE LOWER(name) = 'unknown'
                    LIMIT 1
                ),
                resolvable AS (
                    SELECT f.fact_id, dg.genre_key AS new_genre_key
                    FROM dw.dw_fact_listening_event f
                    JOIN oltp.listening_records lr ON f.original_listening_record_id = lr.id
                    JOIN oltp.tracks t ON t.id = lr.track_id
                    CROSS JOIN unknown_oltp_genre ug
                    JOIN LATERAL (
                        SELECT tg.genre_id
                        FROM %s tg
                        WHERE tg.track_id = t.id
                        ORDER BY (CASE WHEN tg.genre_id = ug.id THEN 1 ELSE 0 END), tg.genre_id
                        LIMIT 1
                    ) pg ON true
                    JOIN dw.dw_dim_genre dg ON dg.original_genre_id = pg.genre_id
                    WHERE f.genre_key = ?
                      AND pg.genre_id <> ug.id
                )
                UPDATE dw.dw_fact_listening_event f
                SET genre_key = r.new_genre_key
                FROM resolvable r
                WHERE f.fact_id = r.fact_id;
                """.formatted(trackGenresTable);

            return jdbcTemplate.update(sql, unknownGenreKey);
        } catch (Exception e) {
            log.error("Failed to resolve unknown genres in warehouse: " + e.getMessage());
            return 0;
        }
    }

    private String resolveRelationTable(String preferredName, String fallbackName) {
        Boolean preferredExists = jdbcTemplate.queryForObject(
                "SELECT to_regclass(?) IS NOT NULL",
                Boolean.class,
                preferredName
        );

        if (Boolean.TRUE.equals(preferredExists)) {
            return preferredName;
        }

        return fallbackName;
    }

    private int insertUnknownDimensions() {
        int inserted = 0;

        inserted += jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_artist (original_artist_id, artist_name, spotify_artist_uri)
                VALUES (-1, 'Unknown Artist', NULL)
                ON CONFLICT (original_artist_id) DO NOTHING
                """);

        inserted += jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_album (original_album_id, album_name, release_year, album_type)
                VALUES (-1, 'Unknown Album', NULL, NULL)
                ON CONFLICT (original_album_id) DO NOTHING
                """);

        inserted += jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_genre (original_genre_id, genre_name)
                VALUES (-1, 'unknown')
                ON CONFLICT (original_genre_id) DO NOTHING
                """);

        return inserted;
    }

    private int insertUserDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_user (original_user_id, username, email, country)
                SELECT DISTINCT
                    u.id,
                    COALESCE(NULLIF(TRIM(u.username), ''), 'unknown_user'),
                    u.email,
                    u.spotify_country
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.app_users u ON u.id = lr.user_id
                WHERE lr.user_id IS NOT NULL
                ON CONFLICT (original_user_id) DO NOTHING
                """);
    }

    private int insertTrackDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_track (original_track_id, spotify_track_uri, track_name, duration_ms, image_url)
                SELECT DISTINCT
                    t.id,
                    t.spotify_track_uri,
                    COALESCE(NULLIF(TRIM(t.track_name), ''), 'Unknown Track'),
                    t.duration_ms,
                    t.image_url
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                WHERE lr.track_id IS NOT NULL
                ON CONFLICT (original_track_id) DO NOTHING
                """);
    }

    private int insertArtistDimensions(String trackArtistsTable) {
        String sql = """
                INSERT INTO dw.dw_dim_artist (original_artist_id, artist_name, spotify_artist_uri)
                SELECT DISTINCT
                    COALESCE(a.id, -1),
                    COALESCE(NULLIF(TRIM(a.artist_name), ''), 'Unknown Artist'),
                    a.spotify_artist_uri
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                LEFT JOIN LATERAL (
                    SELECT artist.id, artist.artist_name, artist.spotify_artist_uri
                    FROM %s ta
                    JOIN oltp.artists artist ON artist.id = ta.artist_id
                    WHERE ta.track_id = t.id
                    ORDER BY artist.id
                    LIMIT 1
                ) a ON true
                ON CONFLICT (original_artist_id) DO NOTHING
                """.formatted(trackArtistsTable);

        return jdbcTemplate.update(sql);
    }

    private int insertAlbumDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_album (original_album_id, album_name, release_year, album_type)
                SELECT DISTINCT
                    COALESCE(album.id, -1),
                    COALESCE(NULLIF(TRIM(album.album_name), ''), 'Unknown Album'),
                    EXTRACT(YEAR FROM album.release_date)::int,
                    album.album_type
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                LEFT JOIN oltp.albums album ON album.id = t.album_id
                ON CONFLICT (original_album_id) DO NOTHING
                """);
    }

    private int insertGenreDimensions(String trackGenresTable) {
        // Sync all genres from oltp.genres to dw.dw_dim_genre first to cover newly enriched ones
        jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_genre (original_genre_id, genre_name)
                SELECT id, name
                FROM oltp.genres
                ON CONFLICT (original_genre_id) DO NOTHING
                """);

        String sql = """
                INSERT INTO dw.dw_dim_genre (original_genre_id, genre_name)
                SELECT DISTINCT
                    COALESCE(g.id, -1),
                    COALESCE(NULLIF(TRIM(g.name), ''), 'unknown')
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                LEFT JOIN LATERAL (
                    SELECT genre.id, genre.name
                    FROM %s tg
                    JOIN oltp.genres genre ON genre.id = tg.genre_id
                    WHERE tg.track_id = t.id
                    ORDER BY (
                        CASE
                            WHEN genre.id = (
                                SELECT id
                                FROM oltp.genres
                                WHERE LOWER(name) = 'unknown'
                                LIMIT 1
                            ) THEN 1
                            ELSE 0
                        END
                    ), genre.id
                    LIMIT 1
                ) g ON true
                ON CONFLICT (original_genre_id) DO NOTHING
                """.formatted(trackGenresTable);

        return jdbcTemplate.update(sql);
    }

    private int insertDateDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_date (
                    date_key,
                    full_date,
                    day,
                    month,
                    month_name,
                    quarter,
                    year,
                    day_of_week,
                    day_name,
                    is_weekend
                )
                SELECT DISTINCT
                    TO_CHAR(lr.played_at::date, 'YYYYMMDD')::bigint,
                    lr.played_at::date,
                    EXTRACT(DAY FROM lr.played_at)::int,
                    EXTRACT(MONTH FROM lr.played_at)::int,
                    TRIM(TO_CHAR(lr.played_at, 'Month')),
                    EXTRACT(QUARTER FROM lr.played_at)::int,
                    EXTRACT(YEAR FROM lr.played_at)::int,
                    EXTRACT(ISODOW FROM lr.played_at)::int,
                    TRIM(TO_CHAR(lr.played_at, 'Day')),
                    EXTRACT(ISODOW FROM lr.played_at)::int >= 6
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                WHERE lr.played_at IS NOT NULL
                ON CONFLICT (full_date) DO NOTHING
                """);
    }

    private int insertTimeDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_time (hour, minute, part_of_day)
                SELECT DISTINCT
                    EXTRACT(HOUR FROM lr.played_at)::int,
                    EXTRACT(MINUTE FROM lr.played_at)::int,
                    CASE
                        WHEN EXTRACT(HOUR FROM lr.played_at)::int >= 5
                             AND EXTRACT(HOUR FROM lr.played_at)::int < 12 THEN 'morning'
                        WHEN EXTRACT(HOUR FROM lr.played_at)::int >= 12
                             AND EXTRACT(HOUR FROM lr.played_at)::int < 17 THEN 'afternoon'
                        WHEN EXTRACT(HOUR FROM lr.played_at)::int >= 17
                             AND EXTRACT(HOUR FROM lr.played_at)::int < 22 THEN 'evening'
                        ELSE 'night'
                    END
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                WHERE lr.played_at IS NOT NULL
                ON CONFLICT (hour, minute) DO NOTHING
                """);
    }

    private int insertPlatformDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_platform (platform_name)
                SELECT DISTINCT COALESCE(NULLIF(TRIM(lr.platform), ''), 'unknown')
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                ON CONFLICT (platform_name) DO NOTHING
                """);
    }

    private int insertSourceDimensions() {
        return jdbcTemplate.update("""
                INSERT INTO dw.dw_dim_source (source_name)
                SELECT DISTINCT COALESCE(NULLIF(TRIM(lr.source::text), ''), 'unknown')
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                ON CONFLICT (source_name) DO NOTHING
                """);
    }

    private int insertFactRows(String trackArtistsTable, String trackGenresTable) {
        String sql = """
                INSERT INTO dw.dw_fact_listening_event
                    (
                        original_listening_record_id,
                        user_key,
                        track_key,
                        artist_key,
                        album_key,
                        genre_key,
                        date_key,
                        time_key,
                        platform_key,
                        source_key,
                        ms_played,
                        minutes_played,
                        play_count,
                        skipped,
                        completion_rate
                    )
                SELECT
                    lr.id,
                    du.user_key,
                    dt.track_key,
                    COALESCE(da.artist_key, unknown_artist.artist_key),
                    COALESCE(dal.album_key, unknown_album.album_key),
                    COALESCE(dg.genre_key, unknown_genre.genre_key),
                    dd.date_key,
                    dtime.time_key,
                    dp.platform_key,
                    ds.source_key,
                    COALESCE(lr.ms_played, 0),
                    COALESCE(lr.ms_played, 0) / 60000.0,
                    1,
                    lr.skipped,
                    CASE
                        WHEN t.duration_ms IS NOT NULL AND t.duration_ms > 0 THEN 
                            LEAST(COALESCE(lr.ms_played, 0)::double precision / t.duration_ms::double precision, 1.0)
                        ELSE 
                            LEAST(COALESCE(lr.ms_played, 0)::double precision / 200000.0, 1.0)
                    END
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                JOIN dw.dw_dim_user du ON du.original_user_id = lr.user_id
                JOIN dw.dw_dim_track dt ON dt.original_track_id = t.id
                JOIN dw.dw_dim_date dd ON dd.full_date = lr.played_at::date
                JOIN dw.dw_dim_time dtime
                    ON dtime.hour = EXTRACT(HOUR FROM lr.played_at)::int
                   AND dtime.minute = EXTRACT(MINUTE FROM lr.played_at)::int
                JOIN LATERAL (
                    SELECT platform_key
                    FROM dw.dw_dim_platform platform_dim
                    WHERE LOWER(platform_dim.platform_name) = LOWER(COALESCE(NULLIF(TRIM(lr.platform), ''), 'unknown'))
                    ORDER BY platform_key
                    LIMIT 1
                ) dp ON true
                JOIN LATERAL (
                    SELECT source_key
                    FROM dw.dw_dim_source source_dim
                    WHERE LOWER(source_dim.source_name) = LOWER(COALESCE(NULLIF(TRIM(lr.source::text), ''), 'unknown'))
                    ORDER BY source_key
                    LIMIT 1
                ) ds ON true
                JOIN dw.dw_dim_artist unknown_artist ON unknown_artist.original_artist_id = -1
                JOIN dw.dw_dim_album unknown_album ON unknown_album.original_album_id = -1
                JOIN dw.dw_dim_genre unknown_genre ON unknown_genre.original_genre_id = -1
                LEFT JOIN LATERAL (
                    SELECT artist.id
                    FROM %s ta
                    JOIN oltp.artists artist ON artist.id = ta.artist_id
                    WHERE ta.track_id = t.id
                    ORDER BY artist.id
                    LIMIT 1
                ) primary_artist ON true
                LEFT JOIN dw.dw_dim_artist da
                    ON da.original_artist_id = COALESCE(primary_artist.id, -1)
                LEFT JOIN oltp.albums album ON album.id = t.album_id
                LEFT JOIN dw.dw_dim_album dal
                    ON dal.original_album_id = COALESCE(album.id, -1)
                LEFT JOIN LATERAL (
                    SELECT genre.id
                    FROM %s tg
                    JOIN oltp.genres genre ON genre.id = tg.genre_id
                    WHERE tg.track_id = t.id
                    ORDER BY (
                        CASE
                            WHEN genre.id = (
                                SELECT id
                                FROM oltp.genres
                                WHERE LOWER(name) = 'unknown'
                                LIMIT 1
                            ) THEN 1
                            ELSE 0
                        END
                    ), genre.id
                    LIMIT 1
                ) primary_genre ON true
                LEFT JOIN dw.dw_dim_genre dg
                    ON dg.original_genre_id = COALESCE(primary_genre.id, -1)
                WHERE lr.user_id IS NOT NULL
                  AND lr.track_id IS NOT NULL
                  AND lr.played_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dw.dw_fact_listening_event existing_fact
                      WHERE existing_fact.original_listening_record_id = lr.id
                  )
                """.formatted(trackArtistsTable, trackGenresTable);

        return jdbcTemplate.update(sql);
    }

    private int countRecordsWithFallbackDimensions(String trackArtistsTable, String trackGenresTable) {
        String sql = """
                SELECT COUNT(*)
                FROM tmp_dw_pending_records p
                JOIN oltp.listening_records lr ON lr.id = p.id
                JOIN oltp.tracks t ON t.id = lr.track_id
                LEFT JOIN oltp.albums album ON album.id = t.album_id
                LEFT JOIN LATERAL (
                    SELECT artist.id
                    FROM %s ta
                    JOIN oltp.artists artist ON artist.id = ta.artist_id
                    WHERE ta.track_id = t.id
                    ORDER BY artist.id
                    LIMIT 1
                ) primary_artist ON true
                LEFT JOIN LATERAL (
                    SELECT genre.id
                    FROM %s tg
                    JOIN oltp.genres genre ON genre.id = tg.genre_id
                    WHERE tg.track_id = t.id
                    ORDER BY (
                        CASE
                            WHEN genre.id = (
                                SELECT id
                                FROM oltp.genres
                                WHERE LOWER(name) = 'unknown'
                                LIMIT 1
                            ) THEN 1
                            ELSE 0
                        END
                    ), genre.id
                    LIMIT 1
                ) primary_genre ON true
                WHERE primary_artist.id IS NULL
                   OR album.id IS NULL
                   OR primary_genre.id IS NULL
                """.formatted(trackArtistsTable, trackGenresTable);

        Integer result = jdbcTemplate.queryForObject(sql, Integer.class);
        return result != null ? result : 0;
    }
}