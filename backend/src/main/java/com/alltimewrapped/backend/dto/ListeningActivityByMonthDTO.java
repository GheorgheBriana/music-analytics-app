package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ListeningActivityByMonthDTO {

    private Integer year;
    private Integer month;
    private Long playCount;
    private Long totalMsPlayed;
}