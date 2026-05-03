package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.UserStatsResponse;
import com.alltimewrapped.backend.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    // returns the main statistics needed for the dashboard
    @GetMapping("/user/{userId}")
    public UserStatsResponse getUserStats(@PathVariable Long userId) {
        return statsService.getUserStats(userId);
    }
}