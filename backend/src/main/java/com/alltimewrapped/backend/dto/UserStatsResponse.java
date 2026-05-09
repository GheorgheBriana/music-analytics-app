package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class UserStatsResponse {

    private Long totalPlays;
    private Long totalMsPlayed;

    // totalMsPlayed converted to hours, rounded to 2 decimals
    private Double totalHoursPlayed;

    private List<TopTrackStatsDTO> top10Tracks;
    private List<TopArtistStatsDTO> top10Artists;

    // shows how listening activity evolved from one year to another
    private List<ListeningActivityByYearDTO> listeningActivityByYear;

    // shows monthly listening activity, useful for timeline charts
    private List<ListeningActivityByMonthDTO> listeningActivityByMonth;

    // shows the strongest artists for each year
    private List<TopArtistByYearDTO> topArtistsByYear;
}