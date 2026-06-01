package com.alltimewrapped.backend.dto;

public record PredictedItem(
    String name,
    double confidence,        // 0.0 - 1.0
    String confidenceLabel    // "HIGH" / "MEDIUM" / "LOW"
) {}
