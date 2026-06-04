package com.alltimewrapped.backend.dto;

public record ProfileStats(
    long totalPlays,
    String topGenre,
    int yearsOfHistory,
    String firstYear,
    String lastYear
) {}
