package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.DiscoveryResponse;
import com.alltimewrapped.backend.service.DiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/discovery")
@RequiredArgsConstructor
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    @GetMapping("/user/{userId}")
    public DiscoveryResponse getRecommendations(
            @PathVariable Long userId,
            @RequestParam(required = false, defaultValue = "comfort") String level) {
        return discoveryService.getRecommendations(userId, level);
    }
}
