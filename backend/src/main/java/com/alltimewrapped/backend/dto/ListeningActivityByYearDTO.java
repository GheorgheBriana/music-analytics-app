package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ListeningActivityByYearDTO {

    private Integer year;
    private Long playCount;
    private Long totalMsPlayed;
}