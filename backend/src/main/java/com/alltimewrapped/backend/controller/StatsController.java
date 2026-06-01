package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.DailyActivityDTO;
import com.alltimewrapped.backend.dto.UserStatsResponse;
import com.alltimewrapped.backend.dto.PeriodStatsDTO;
import com.alltimewrapped.backend.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/user/{userId}/period-metrics")
    public PeriodStatsDTO getPeriodMetrics(
            @PathVariable Long userId,
            @RequestParam(required = false, defaultValue = "month") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate anchor,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate customStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate customEnd
    ) {
        return statsService.getPeriodStats(userId, period, anchor, customStart, customEnd);
    }

    // returns the main statistics needed for the dashboard
    // if from and to are missing, the response is generated for the full imported history
    // if from and to are provided, the response is generated only for that date range
    @GetMapping("/user/{userId}")
    public UserStatsResponse getUserStats(
            @PathVariable Long userId,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to
    ) {
        return statsService.getUserStats(userId, from, to);
    }

    // returns daily activity used by the frontend heatmap
    @GetMapping("/user/{userId}/daily-activity")
    public List<DailyActivityDTO> getDailyActivity(
            @PathVariable Long userId,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to
    ) {
        return statsService.getDailyActivity(userId, from, to);
    }

    @GetMapping("/user/{userId}/genres")
    public Map<String, Long> getGenres(@PathVariable Long userId) {
        return statsService.getUserGenreStats(userId);
    }

    @GetMapping("/user/{userId}/recommendations")
    public List<String> getRecommendations(@PathVariable Long userId) {
        return statsService.getRecommendations(userId);
    }
}