package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
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

    private static final double MS_TO_HOURS = 3_600_000.0;
    private static final int TOP_ITEMS_LIMIT = 10;

    // builds the main statistics response for one user
    @Transactional(readOnly = true)
    public UserStatsResponse getUserStats(Long userId, LocalDate from, LocalDate to) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "User not found with id: " + userId
            );
        }

        validateDateRange(from, to);

        if (from == null && to == null) {
            return buildAllTimeStats(userId);
        }

        OffsetDateTime fromDateTime = from.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime toDateTimeExclusive = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        return buildFilteredStats(userId, fromDateTime, toDateTimeExclusive);
    }

    // builds daily listening activity for the heatmap
    @Transactional(readOnly = true)
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

        OffsetDateTime fromDateTime = startDate.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime toDateTimeExclusive = endDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        return listeningRecordRepository.findDailyActivityByUserIdBetween(
                userId,
                fromDateTime,
                toDateTimeExclusive
        );
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
                            .limit(TOP_ITEMS_LIMIT)
                            .toList()
            );
        }

        return limitedArtistsByYear;
    }

    // keeps dashboard numbers easier to read
    private double roundToTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}