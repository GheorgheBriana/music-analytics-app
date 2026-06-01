package com.alltimewrapped.backend.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DimensionScoreDTO {
    private double jaccard;       // 0.0 - 1.0 (binary set overlap)
    private double cosine;        // 0.0 - 1.0 (intensity-weighted cosine)
    private int finalPercent;     // 0 - 100 (percentage score for display)
}
