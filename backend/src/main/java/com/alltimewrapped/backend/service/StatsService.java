package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ListeningActivityByMonthDTO;
import com.alltimewrapped.backend.dto.ListeningActivityByYearDTO;
import com.alltimewrapped.backend.dto.TopArtistByYearDTO;
import com.alltimewrapped.backend.dto.TopArtistStatsDTO;
import com.alltimewrapped.backend.dto.TopTrackStatsDTO;
import com.alltimewrapped.backend.dto.UserStatsResponse;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    public UserStatsResponse getUserStats(Long userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "User not found with id: " + userId
            );
        }

        // counts all imported listening records for this user
        long totalPlays = listeningRecordRepository.countByUserId(userId);

        // gets the total listening time in milliseconds
        long totalMsPlayed = listeningRecordRepository.getTotalMsPlayedByUserId(userId);

        // converts milliseconds to hours for easier display in the dashboard
        double totalHoursPlayed = roundToTwoDecimals(totalMsPlayed / MS_TO_HOURS);

        // gets the top 10 tracks ordered by play count
        List<TopTrackStatsDTO> top10Tracks = listeningRecordRepository.findTopTracksByUserId(
                userId,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        // gets the top 10 artists ordered by play count
        List<TopArtistStatsDTO> top10Artists = listeningRecordRepository.findTopArtistsByUserId(
                userId,
                PageRequest.of(0, TOP_ITEMS_LIMIT)
        );

        // gets yearly listening activity for timeline analysis
        List<ListeningActivityByYearDTO> listeningActivityByYear =
                listeningRecordRepository.findListeningActivityByYear(userId);

        // gets monthly listening activity for more detailed charts
        List<ListeningActivityByMonthDTO> listeningActivityByMonth =
                listeningRecordRepository.findListeningActivityByMonth(userId);

        // gets all artists grouped by year, ordered by year and play count
        List<TopArtistByYearDTO> allArtistsByYear =
                listeningRecordRepository.findTopArtistsByYear(userId);

        // keeps only the top artists for each year to avoid returning a very large response
        List<TopArtistByYearDTO> topArtistsByYear = keepTopArtistsPerYear(allArtistsByYear);

        return new UserStatsResponse(
                totalPlays,
                totalMsPlayed,
                totalHoursPlayed,
                top10Tracks,
                top10Artists,
                listeningActivityByYear,
                listeningActivityByMonth,
                topArtistsByYear
        );
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