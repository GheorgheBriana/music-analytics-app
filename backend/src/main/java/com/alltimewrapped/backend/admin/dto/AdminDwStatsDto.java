package com.alltimewrapped.backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDwStatsDto {
    private long totalFacts;
    private long totalUsers;
    private long totalTracks;
    private long totalArtists;
    private long totalAlbums;
    private long totalGenres;
    private Map<String, Long> factsByPartition; // ex: {"2023": 12000, "2024": 50000}
    private Map<String, Long> materializedViewSizes; // ex: {"mv_top_genres": 250}
}
