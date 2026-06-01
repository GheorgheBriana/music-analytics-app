package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PeriodStatsDTO {
    private Metrics current;
    private Trends trends;
    private String periodLabel;
    private List<Long> hourlyPlays;
    private List<Double> hourlyMinutes;
    private List<Long> weekdayPlays;
    private List<Integer> availableYears;
    private boolean isLatestPeriod;
    private boolean isOldestPeriod;
    private LocalDate anchorDate;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Metrics {
        private long streams;
        private long uniqueTracks;
        private double minutes;
        private long uniqueArtists;
        private double hours;
        private long uniqueAlbums;
        private long daysCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Trends {
        private Double streams;
        private Double uniqueTracks;
        private Double minutes;
        private Double uniqueArtists;
        private Double hours;
        private Double uniqueAlbums;
        private Double daysCount;
    }
}
