package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.analytics.model.*;
import com.alltimewrapped.backend.analytics.repository.*;
import com.alltimewrapped.backend.model.*;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
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

@Service
@RequiredArgsConstructor
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

    @Transactional
    public Map<String, Object> refreshWarehouse(int limit) {
        List<ListeningRecord> records = listeningRecordRepository.findRecordsNotInWarehouse(limit);
        return processRecordsIntoWarehouse(records, limit);
    }

    @Transactional
    public Map<String, Object> refreshWarehouseForUser(Long userId, int limit) {
        List<ListeningRecord> records = listeningRecordRepository.findRecordsNotInWarehouseForUser(userId, limit);
        return processRecordsIntoWarehouse(records, limit);
    }

    private Map<String, Object> processRecordsIntoWarehouse(List<ListeningRecord> records, int limit) {
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

            DwDimUser userDim = findOrCreateUser(record.getUser(), userCache);
            DwDimTrack trackDim = findOrCreateTrack(track, trackCache);
            DwDimArtist artistDim = findOrCreateArtist(primaryArtist, artistCache);
            DwDimAlbum albumDim = findOrCreateAlbum(album, albumCache);
            DwDimGenre genreDim = findOrCreateGenre(primaryGenre, genreCache);
            DwDimDate dateDim = findOrCreateDate(record.getPlayedAt(), dateCache);
            DwDimTime timeDim = findOrCreateTime(record.getPlayedAt(), timeCache);
            DwDimPlatform platformDim = findOrCreatePlatform(record.getPlatform(), platformCache);
            DwDimSource sourceDim = findOrCreateSource(record.getSource(), sourceCache);

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
                dwFactListeningEventRepository.saveAll(factBatch);
                factBatch.clear();
            }
        }

        // flush remaining facts
        if (!factBatch.isEmpty()) {
            dwFactListeningEventRepository.saveAll(factBatch);
        }

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
        if (msPlayed == null || durationMs == null || durationMs <= 0) {
            return null;
        }

        double rate = msPlayed.doubleValue() / durationMs.doubleValue();
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

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }
}