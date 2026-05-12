package com.alltimewrapped.backend.dto;

public record PredictionResponse(
        String predictedTopArtist,
        String mostActiveDayOfWeek,
        Integer mostActiveHour,
        String listeningTrend,
        String mostActiveMonth,
        Double listeningChangePercent
) {
}