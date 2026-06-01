package com.alltimewrapped.backend.dto;

import java.util.List;

public record TrendAnalysis(
    String direction,                 // "INCREASING" / "DECREASING" / "STABLE"
    double slope,                     // monthly plays change per month
    double rSquared,                  // 0.0 - 1.0
    String confidenceLabel,           // "HIGH" / "MEDIUM" / "LOW"
    List<TrendPoint> historicalSeries,
    List<TrendPoint> projectedSeries  // next 3 months projection
) {}
