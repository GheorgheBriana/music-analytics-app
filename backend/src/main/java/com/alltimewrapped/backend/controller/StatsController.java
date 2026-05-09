package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.UserStatsResponse;
import com.alltimewrapped.backend.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

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
}