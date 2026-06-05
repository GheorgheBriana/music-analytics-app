package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.service.SpotifyLinkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/spotify")
public class SpotifySyncController {

    private final SpotifyLinkService spotifyLinkService;

    public SpotifySyncController(SpotifyLinkService spotifyLinkService) {
        this.spotifyLinkService = spotifyLinkService;
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> sync(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(spotifyLinkService.syncRecentlyPlayed(userId));
    }
}
