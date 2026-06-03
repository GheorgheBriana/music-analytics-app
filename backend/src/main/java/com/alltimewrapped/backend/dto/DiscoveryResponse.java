package com.alltimewrapped.backend.dto;

import java.util.List;

public record DiscoveryResponse(
    List<DiscoveryRecommendation> recommendations,
    String fallbackMessage
) {}
