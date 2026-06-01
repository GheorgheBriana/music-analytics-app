package com.alltimewrapped.backend.analytics.controller;

import com.alltimewrapped.backend.analytics.service.AdvancedAnalyticsService;
import com.alltimewrapped.backend.analytics.service.AnalyticsPipelineService;
import com.alltimewrapped.backend.analytics.service.AnalyticsRefreshService;
import com.alltimewrapped.backend.analytics.service.AnalyticsStatusService;
import com.alltimewrapped.backend.analytics.service.AnalyticsValidationService;
import com.alltimewrapped.backend.analytics.service.DwStatsService;
import com.alltimewrapped.backend.analytics.service.MusicInsightService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "BI reports, statistical analysis, and Data Warehouse analytics")
public class AnalyticsController {

    private final AnalyticsRefreshService analyticsRefreshService;
    private final AnalyticsPipelineService analyticsPipelineService;
    private final AnalyticsStatusService analyticsStatusService;
    private final AnalyticsValidationService analyticsValidationService;
    private final DwStatsService dwStatsService;
    private final MusicInsightService musicInsightService;
    private final AdvancedAnalyticsService advancedAnalyticsService;
    private final com.alltimewrapped.backend.analytics.service.MusicBrainzEnrichmentService musicBrainzEnrichmentService;

    @PostMapping("/refresh")
    @Operation(summary = "Refresh Warehouse", description = "Incrementally loads new listening records from the transactional space (OLTP) to the fact table (DW).")
    public Map<String, Object> refreshWarehouse(
            @RequestParam(defaultValue = "500") int limit
    ) {
        return analyticsRefreshService.refreshWarehouse(limit);
    }

    @PostMapping("/pipeline/rebuild")
    @Operation(summary = "Rebuild Analytics Data", description = "Executes relationship backfilling and then rebuilds the Data Warehouse fact events.")
    public Map<String, Object> rebuildAnalyticsData(
            @RequestParam(defaultValue = "200") int backfillLimit,
            @RequestParam(defaultValue = "500") int refreshLimit
    ) {
        return analyticsPipelineService.rebuildAnalyticsData(backfillLimit, refreshLimit);
    }

    @GetMapping("/status")
    @Operation(summary = "Get Warehouse Status", description = "Retrieves the statistics and status of sync operations, pending dimensions, and data freshness.")
    public Map<String, Object> getWarehouseStatus() {
        return analyticsStatusService.getWarehouseStatus();
    }

    @GetMapping("/validation")
    @Operation(summary = "Validate Warehouse Data", description = "Runs transactional versus dimensional data check queries to validate warehouse consistency.")
    public Map<String, Object> validateWarehouse() {
        return analyticsValidationService.validateWarehouse();
    }

    @GetMapping("/reports/summary")
    @Operation(summary = "Get User Analytics Summary", description = "Retrieves high-level summary counters such as total plays, hours listened, and distinct items.")
    public Map<String, Object> getWarehouseSummary(@RequestParam(required = false) Long userId) {
        return dwStatsService.getWarehouseSummary(userId);
    }

    @GetMapping("/reports/monthly-listening")
    @Operation(summary = "Get Monthly Listening Report", description = "Retrieves aggregated scrobble counts grouped by month from materialized views.")
    public List<Map<String, Object>> getMonthlyListening(@RequestParam(required = false) Long userId) {
        return dwStatsService.getMonthlyListening(userId);
    }

    @GetMapping("/reports/part-of-day")
    @Operation(summary = "Get Part of Day Distribution", description = "Aggregates music listening patterns across different segments of the day (Morning, Afternoon, Evening, Night).")
    public List<Map<String, Object>> getPartOfDayStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPartOfDayStats(userId);
    }

    @GetMapping("/reports/weekend-vs-weekday")
    @Operation(summary = "Get Weekend vs Weekday Habits", description = "Compares average daily play volumes and times between weekdays and weekends.")
    public List<Map<String, Object>> getWeekendVsWeekdayStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getWeekendVsWeekdayStats(userId);
    }

    @GetMapping("/reports/top-genres")
    @Operation(summary = "Get Top Listening Genres", description = "Aggregates the user's top music genres and relative percentages using materialized views.")
    public List<Map<String, Object>> getTopGenres(@RequestParam(required = false) Long userId) {
        return dwStatsService.getTopGenres(userId);
    }

    @GetMapping("/reports/rollup-listening")
    @Operation(summary = "Get Listening Rollup", description = "Executes a multi-dimensional rollup query to aggregate plays by artist, track, and year.")
    public List<Map<String, Object>> getRollupListening(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getRollupListening(userId);
    }

    @GetMapping("/reports/completion-rate-by-artist")
    @Operation(summary = "Get Completion Rate by Artist", description = "Computes average song completion rates (ratio of ms played to total duration) grouped by artist.")
    public List<Map<String, Object>> getCompletionRateByArtist(@RequestParam(required = false) Long userId) {
        return dwStatsService.getCompletionRateByArtist(userId);
    }

    @GetMapping("/reports/platforms")
    @Operation(summary = "Get Platform Distribution", description = "Aggregates plays and listening minutes by platform (Spotify, Local files, etc.).")
    public List<Map<String, Object>> getPlatformStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPlatformStats(userId);
    }

    @GetMapping("/reports/listening-heatmap")
    @Operation(summary = "Get Weekly Listening Heatmap", description = "Returns a grid matrix mapping play intensity across day-of-week and hour-of-day coordinates.")
    public List<Map<String, Object>> getListeningHeatmap(@RequestParam(required = false) Long userId) {
        return dwStatsService.getListeningHeatmap(userId);
    }

    @GetMapping("/reports/peak-listening-time")
    @Operation(summary = "Get Peak Listening Hour", description = "Extracts the exact hour and weekday where the highest concentration of plays occurs.")
    public Map<String, Object> getPeakListeningTime(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPeakListeningTime(userId);
    }

    @GetMapping("/reports/listening-personality")
    @Operation(summary = "Get Listening Personality Profile", description = "Processes skip frequencies, artist diversity, and consistency indices to classify the user into a custom music profile.")
    public Map<String, Object> getListeningPersonality(@RequestParam(required = false) Long userId) {
        return dwStatsService.getListeningPersonality(userId);
    }

    @GetMapping("/reports/music-insights")
    @Operation(summary = "Get AI and Statistical Music Insights", description = "Calculates advanced statistical indicators like Z-Scores for spikes, OLS linear regression for growth trend, and recency decay scores.")
    public Map<String, Object> getMusicInsights(@RequestParam(required = false) Long userId) {
        return musicInsightService.getMusicInsights(userId);
    }

    @GetMapping("/reports/monthly-growth")
    @Operation(summary = "Get Monthly Growth Rate", description = "Retrieves consecutive month growth percentages for play volume and time.")
    public List<Map<String, Object>> getMonthlyGrowth(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getMonthlyGrowth(userId);
    }

    @GetMapping("/reports/top-genre-by-month")
    @Operation(summary = "Get Top Genre by Month", description = "Tracks the user's primary genre preference shift month-by-month across their history.")
    public List<Map<String, Object>> getTopGenreByMonth(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getTopGenreByMonth(userId);
    }

    @GetMapping("/reports/artist-loyalty")
    @Operation(summary = "Get Artist Loyalty Score", description = "Calculates repeat-play indices and long-term artist affinity metrics.")
    public List<Map<String, Object>> getArtistLoyalty(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getArtistLoyalty(userId);
    }

    @GetMapping("/reports/advanced-overview")
    @Operation(summary = "Get Advanced BI Overview", description = "Calculates overall listening diversity indices, skewness, and statistical summaries.")
    public Map<String, Object> getAdvancedAnalyticsOverview(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getAdvancedAnalyticsOverview(userId);
    }

    @GetMapping("/reports/artist-ranking-evolution")
    @Operation(summary = "Get Artist Ranking Evolution", description = "Tracks rank shifts among top artists month-over-month to visualize evolution.")
    public List<Map<String, Object>> getArtistRankingEvolution(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getArtistRankingEvolution(userId);
    }

    @PostMapping("/enrichment/musicbrainz-genres")
    @Operation(summary = "Enrich Artist Genres", description = "Queries MusicBrainz API for artist tags/genres and stores them in the tranzactional catalog.")
    public Map<String, Object> enrichArtists(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return musicBrainzEnrichmentService.enrichArtists(limit);
    }
}