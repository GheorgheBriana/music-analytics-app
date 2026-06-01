package com.alltimewrapped.backend.dto;

public record Forecast(
    double predictedPlays,
    double lowerBound,      // 95% CI lower
    double upperBound,      // 95% CI upper
    String periodLabel      // "Next month: April 2025"
) {}
