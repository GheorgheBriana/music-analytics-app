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
    public Map<String, Object> getWarehouseSummary() {
        return dwStatsService.getWarehouseSummary();
    }

    @GetMapping("/reports/monthly-listening")
    public List<Map<String, Object>> getMonthlyListening() {
        return dwStatsService.getMonthlyListening();
    }

    @GetMapping("/reports/part-of-day")
    public List<Map<String, Object>> getPartOfDayStats() {
        return dwStatsService.getPartOfDayStats();
    }

    @GetMapping("/reports/weekend-vs-weekday")
    public List<Map<String, Object>> getWeekendVsWeekdayStats() {
        return dwStatsService.getWeekendVsWeekdayStats();
    }

    @GetMapping("/reports/top-genres")
    public List<Map<String, Object>> getTopGenres() {
        return dwStatsService.getTopGenres();
    }

    @GetMapping("/reports/completion-rate-by-artist")
    public List<Map<String, Object>> getCompletionRateByArtist() {
        return dwStatsService.getCompletionRateByArtist();
    }

    @GetMapping("/reports/platforms")
    public List<Map<String, Object>> getPlatformStats() {
        return dwStatsService.getPlatformStats();
    }

    @GetMapping("/reports/listening-heatmap")
    public List<Map<String, Object>> getListeningHeatmap() {
        return dwStatsService.getListeningHeatmap();
    }

    @GetMapping("/reports/peak-listening-time")
    public Map<String, Object> getPeakListeningTime() {
        return dwStatsService.getPeakListeningTime();
    }

    @GetMapping("/reports/listening-personality")
    public Map<String, Object> getListeningPersonality() {
        return dwStatsService.getListeningPersonality();
    }

    @GetMapping("/reports/music-insights")
    public Map<String, Object> getMusicInsights() {
        return musicInsightService.getMusicInsights();
    }

    @GetMapping("/reports/monthly-growth")
    public List<Map<String, Object>> getMonthlyGrowth() {
        return advancedAnalyticsService.getMonthlyGrowth();
    }

    @GetMapping("/reports/top-genre-by-month")
    public List<Map<String, Object>> getTopGenreByMonth() {
        return advancedAnalyticsService.getTopGenreByMonth();
    }

    @GetMapping("/reports/artist-loyalty")
    public List<Map<String, Object>> getArtistLoyalty() {
        return advancedAnalyticsService.getArtistLoyalty();
    }

    @GetMapping("/reports/advanced-overview")
    public Map<String, Object> getAdvancedAnalyticsOverview() {
        return advancedAnalyticsService.getAdvancedAnalyticsOverview();
    }
}