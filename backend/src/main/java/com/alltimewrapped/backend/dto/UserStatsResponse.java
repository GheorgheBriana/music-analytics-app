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
}