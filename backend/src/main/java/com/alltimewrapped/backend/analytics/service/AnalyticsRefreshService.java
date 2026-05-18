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

        int processedRecords = 0;
        int insertedFacts = 0;
        int skippedInvalidRecords = 0;
        int recordsWithFallbackDimensions = 0;

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

            DwDimUser userDim = findOrCreateUser(record.getUser());
            DwDimTrack trackDim = findOrCreateTrack(track);
            DwDimArtist artistDim = findOrCreateArtist(primaryArtist);
            DwDimAlbum albumDim = findOrCreateAlbum(album);
            DwDimGenre genreDim = findOrCreateGenre(primaryGenre);
            DwDimDate dateDim = findOrCreateDate(record.getPlayedAt());
            DwDimTime timeDim = findOrCreateTime(record.getPlayedAt());
            DwDimPlatform platformDim = findOrCreatePlatform(record.getPlatform());
            DwDimSource sourceDim = findOrCreateSource(record.getSource());

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

            dwFactListeningEventRepository.save(fact);
            insertedFacts++;
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

    private DwDimUser findOrCreateUser(AppUser user) {
        return dwDimUserRepository.findByOriginalUserId(user.getId())
                .orElseGet(() -> dwDimUserRepository.save(
                        DwDimUser.builder()
                                .originalUserId(user.getId())
                                .username(normalize(user.getUsername(), "unknown_user"))
                                .email(user.getEmail())
                                .country(null)
                                .build()
                ));
    }

    private DwDimTrack findOrCreateTrack(Track track) {
        return dwDimTrackRepository.findByOriginalTrackId(track.getId())
                .orElseGet(() -> dwDimTrackRepository.save(
                        DwDimTrack.builder()
                                .originalTrackId(track.getId())
                                .spotifyTrackUri(track.getSpotifyTrackUri())
                                .trackName(normalize(track.getTrackName(), "Unknown Track"))
                                .durationMs(track.getDurationMs())
                                .imageUrl(track.getImageUrl())
                                .build()
                ));
    }

    private DwDimArtist findOrCreateArtist(Artist artist) {
        if (artist == null || artist.getId() == null) {
            return findOrCreateUnknownArtist();
        }

        return dwDimArtistRepository.findByOriginalArtistId(artist.getId())
                .orElseGet(() -> dwDimArtistRepository.save(
                        DwDimArtist.builder()
                                .originalArtistId(artist.getId())
                                .artistName(normalize(artist.getArtistName(), "Unknown Artist"))
                                .spotifyArtistUri(artist.getSpotifyArtistUri())
                                .build()
                ));
    }

    private DwDimArtist findOrCreateUnknownArtist() {
        return dwDimArtistRepository.findByOriginalArtistId(UNKNOWN_ARTIST_ID)
                .orElseGet(() -> dwDimArtistRepository.save(
                        DwDimArtist.builder()
                                .originalArtistId(UNKNOWN_ARTIST_ID)
                                .artistName("Unknown Artist")
                                .spotifyArtistUri(null)
                                .build()
                ));
    }

    private DwDimAlbum findOrCreateAlbum(Album album) {
        if (album == null || album.getId() == null) {
            return findOrCreateUnknownAlbum();
        }

        return dwDimAlbumRepository.findByOriginalAlbumId(album.getId())
                .orElseGet(() -> dwDimAlbumRepository.save(
                        DwDimAlbum.builder()
                                .originalAlbumId(album.getId())
                                .albumName(normalize(album.getAlbumName(), "Unknown Album"))
                                .releaseYear(album.getReleaseDate() != null ? album.getReleaseDate().getYear() : null)
                                .albumType(album.getAlbumType())
                                .build()
                ));
    }

    private DwDimAlbum findOrCreateUnknownAlbum() {
        return dwDimAlbumRepository.findByOriginalAlbumId(UNKNOWN_ALBUM_ID)
                .orElseGet(() -> dwDimAlbumRepository.save(
                        DwDimAlbum.builder()
                                .originalAlbumId(UNKNOWN_ALBUM_ID)
                                .albumName("Unknown Album")
                                .releaseYear(null)
                                .albumType(null)
                                .build()
                ));
    }

    private DwDimGenre findOrCreateGenre(Genre genre) {
        if (genre == null || genre.getId() == null) {
            return findOrCreateUnknownGenre();
        }

        return dwDimGenreRepository.findByOriginalGenreId(genre.getId())
                .orElseGet(() -> dwDimGenreRepository.save(
                        DwDimGenre.builder()
                                .originalGenreId(genre.getId())
                                .genreName(normalize(genre.getName(), "unknown"))
                                .build()
                ));
    }

    private DwDimGenre findOrCreateUnknownGenre() {
        return dwDimGenreRepository.findByOriginalGenreId(UNKNOWN_GENRE_ID)
                .orElseGet(() -> dwDimGenreRepository.save(
                        DwDimGenre.builder()
                                .originalGenreId(UNKNOWN_GENRE_ID)
                                .genreName("unknown")
                                .build()
                ));
    }

    private DwDimDate findOrCreateDate(OffsetDateTime playedAt) {
        LocalDate fullDate = playedAt.toLocalDate();

        return dwDimDateRepository.findByFullDate(fullDate)
                .orElseGet(() -> {
                    int month = fullDate.getMonthValue();

                    return dwDimDateRepository.save(
                            DwDimDate.builder()
                                    .fullDate(fullDate)
                                    .day(fullDate.getDayOfMonth())
                                    .month(month)
                                    .monthName(fullDate.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH))
                                    .quarter(((month - 1) / 3) + 1)
                                    .year(fullDate.getYear())
                                    .dayOfWeek(fullDate.getDayOfWeek().getValue())
                                    .dayName(fullDate.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH))
                                    .isWeekend(fullDate.getDayOfWeek().getValue() >= 6)
                                    .build()
                    );
                });
    }

    private DwDimTime findOrCreateTime(OffsetDateTime playedAt) {
        int hour = playedAt.getHour();
        int minute = playedAt.getMinute();

        return dwDimTimeRepository.findByHourAndMinute(hour, minute)
                .orElseGet(() -> dwDimTimeRepository.save(
                        DwDimTime.builder()
                                .hour(hour)
                                .minute(minute)
                                .partOfDay(resolvePartOfDay(hour))
                                .build()
                ));
    }

    private DwDimPlatform findOrCreatePlatform(String platform) {
        String platformName = normalize(platform, "unknown");

        return dwDimPlatformRepository.findByPlatformNameIgnoreCase(platformName)
                .orElseGet(() -> dwDimPlatformRepository.save(
                        DwDimPlatform.builder()
                                .platformName(platformName)
                                .build()
                ));
    }

    private DwDimSource findOrCreateSource(ListeningSource source) {
        String sourceName = source != null ? source.name() : "unknown";

        return dwDimSourceRepository.findBySourceNameIgnoreCase(sourceName)
                .orElseGet(() -> dwDimSourceRepository.save(
                        DwDimSource.builder()
                                .sourceName(sourceName)
                                .build()
                ));
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