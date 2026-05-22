package com.alltimewrapped.backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDataQualityDto {
    private long oltpListeningRecordsCount;
    private long dwFactsCount;
    private double dwCoveragePercentage;
    private long knownGenreFacts;
    private long unknownGenreFacts;
    private double genreEnrichmentCoverage;
    private long tracksWithoutDuration;
    private long tracksWithDuration;
    private long materializedViewRowCounts;
}
