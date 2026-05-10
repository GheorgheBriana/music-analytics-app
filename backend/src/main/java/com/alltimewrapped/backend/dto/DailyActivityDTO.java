package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DailyActivityDTO {

    private Integer year;
    private Integer month;
    private Integer day;
    private Long playCount;
    private Long totalMsPlayed;
}