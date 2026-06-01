package com.alltimewrapped.backend.dto;

public record Anomaly(
    String periodLabel,     // "December 2023"
    double plays,
    double zScore,          // standard deviations from mean
    String type             // "PEAK" or "DROP"
) {}
