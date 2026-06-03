package com.alltimewrapped.backend.dto;

public record GenreProjection(
    String genreName,
    double slope,
    double rSquared,
    String confidenceLabel
) {}
