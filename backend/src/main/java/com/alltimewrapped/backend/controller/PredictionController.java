package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.PredictionResponse;
import com.alltimewrapped.backend.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;

    @GetMapping("/user/{userId}")
    public PredictionResponse getPredictions(@PathVariable Long userId) {
        return predictionService.getPredictions(userId);
    }
}