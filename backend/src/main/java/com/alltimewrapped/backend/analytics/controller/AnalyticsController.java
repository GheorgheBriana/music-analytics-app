package com.alltimewrapped.backend.analytics.controller;

import com.alltimewrapped.backend.analytics.service.AdvancedAnalyticsService;
import com.alltimewrapped.backend.analytics.service.AnalyticsPipelineService;
import com.alltimewrapped.backend.analytics.service.AnalyticsRefreshService;
import com.alltimewrapped.backend.analytics.service.AnalyticsStatusService;
import com.alltimewrapped.backend.analytics.service.AnalyticsValidationService;
import com.alltimewrapped.backend.analytics.service.DwStatsService;
import com.alltimewrapped.backend.analytics.service.MusicInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
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
    public Map<String, Object> refreshWarehouse(
            @RequestParam(defaultValue = "500") int limit
    ) {
        return analyticsRefreshService.refreshWarehouse(limit);
    }

    @PostMapping("/pipeline/rebuild")
    public Map<String, Object> rebuildAnalyticsData(
            @RequestParam(defaultValue = "200") int backfillLimit,
            @RequestParam(defaultValue = "500") int refreshLimit
    ) {
        return analyticsPipelineService.rebuildAnalyticsData(backfillLimit, refreshLimit);
    }

    @GetMapping("/status")
    public Map<String, Object> getWarehouseStatus() {
        return analyticsStatusService.getWarehouseStatus();
    }

    @GetMapping("/validation")
    public Map<String, Object> validateWarehouse() {
        return analyticsValidationService.validateWarehouse();
    }

    @GetMapping("/reports/summary")
    public Map<String, Object> getWarehouseSummary(@RequestParam(required = false) Long userId) {
        return dwStatsService.getWarehouseSummary(userId);
    }

    @GetMapping("/reports/monthly-listening")
    public List<Map<String, Object>> getMonthlyListening(@RequestParam(required = false) Long userId) {
        return dwStatsService.getMonthlyListening(userId);
    }

    @GetMapping("/reports/part-of-day")
    public List<Map<String, Object>> getPartOfDayStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPartOfDayStats(userId);
    }

    @GetMapping("/reports/weekend-vs-weekday")
    public List<Map<String, Object>> getWeekendVsWeekdayStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getWeekendVsWeekdayStats(userId);
    }

    @GetMapping("/reports/top-genres")
    public List<Map<String, Object>> getTopGenres(@RequestParam(required = false) Long userId) {
        return dwStatsService.getTopGenres(userId);
    }

    @GetMapping("/reports/rollup-listening")
    public List<Map<String, Object>> getRollupListening(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getRollupListening(userId);
    }

    @GetMapping("/reports/completion-rate-by-artist")
    public List<Map<String, Object>> getCompletionRateByArtist(@RequestParam(required = false) Long userId) {
        return dwStatsService.getCompletionRateByArtist(userId);
    }

    @GetMapping("/reports/platforms")
    public List<Map<String, Object>> getPlatformStats(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPlatformStats(userId);
    }

    @GetMapping("/reports/listening-heatmap")
    public List<Map<String, Object>> getListeningHeatmap(@RequestParam(required = false) Long userId) {
        return dwStatsService.getListeningHeatmap(userId);
    }

    @GetMapping("/reports/peak-listening-time")
    public Map<String, Object> getPeakListeningTime(@RequestParam(required = false) Long userId) {
        return dwStatsService.getPeakListeningTime(userId);
    }

    @GetMapping("/reports/listening-personality")
    public Map<String, Object> getListeningPersonality(@RequestParam(required = false) Long userId) {
        return dwStatsService.getListeningPersonality(userId);
    }

    @GetMapping("/reports/music-insights")
    public Map<String, Object> getMusicInsights(@RequestParam(required = false) Long userId) {
        return musicInsightService.getMusicInsights(userId);
    }

    @GetMapping("/reports/monthly-growth")
    public List<Map<String, Object>> getMonthlyGrowth(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getMonthlyGrowth(userId);
    }

    @GetMapping("/reports/top-genre-by-month")
    public List<Map<String, Object>> getTopGenreByMonth(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getTopGenreByMonth(userId);
    }

    @GetMapping("/reports/artist-loyalty")
    public List<Map<String, Object>> getArtistLoyalty(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getArtistLoyalty(userId);
    }

    @GetMapping("/reports/advanced-overview")
    public Map<String, Object> getAdvancedAnalyticsOverview(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getAdvancedAnalyticsOverview(userId);
    }

    @GetMapping("/reports/artist-ranking-evolution")
    public List<Map<String, Object>> getArtistRankingEvolution(@RequestParam(required = false) Long userId) {
        return advancedAnalyticsService.getArtistRankingEvolution(userId);
    }

    @PostMapping("/enrichment/musicbrainz-genres")
    public Map<String, Object> enrichArtists(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return musicBrainzEnrichmentService.enrichArtists(limit);
    }
}