package com.alltimewrapped.backend.dto;

import java.util.List;
import java.util.Map;

public record PredictionResponse(
    PredictedItem predictedTopArtist,
    Map<String, Double> dayOfWeekProbabilities,
    Map<Integer, Double> hourProbabilities,
    Map<String, Double> monthProbabilities,
    TrendAnalysis trend,
    Forecast nextMonthForecast,
    List<Anomaly> anomalies,
    List<GenreTrajectory> risingGenres,
    List<GenreTrajectory> fadingGenres,
    // backward compat for old UI
    String mostActiveDayOfWeek,
    Integer mostActiveHour,
    String mostActiveMonth,
    String listeningTrend,
    Double listeningChangePercent
) {}