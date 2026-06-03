package com.alltimewrapped.backend.dto;

public record DiscoveryRecommendation(
    String artistName,
    String genreName,
    String level,
    String simpleReason,
    String detailedReason
) {}
