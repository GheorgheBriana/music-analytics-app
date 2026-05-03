package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TopTrackStatsDTO {

    private String trackName;
    private String artistName;
    private Long playCount;
    private Long totalMsPlayed;
}