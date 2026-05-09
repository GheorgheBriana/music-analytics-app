package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TopArtistByYearDTO {

    private Integer year;
    private String artistName;
    private Long playCount;
    private Long totalMsPlayed;
}