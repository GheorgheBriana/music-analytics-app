package com.alltimewrapped.backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminEnrichmentStatusDto {
    private long totalArtists;
    private long enrichedArtists;
    private long pendingArtists;
    private long totalGenres;
    private long totalTrackGenreLinks;
    private double enrichmentProgressPercentage;
}
