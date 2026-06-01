package com.alltimewrapped.backend.dto;

public record TrendPoint(
    String label,    // "2024-03"
    double actual,   // -1 if projected
    double fitted    // value from regression line
) {}
