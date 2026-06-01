package com.alltimewrapped.backend.dto;

public record GenreTrajectory(
    String genreName,
    double slope,              // plays/month change
    double currentMonthlyAvg,
    String direction           // "RISING" or "FADING"
) {}
