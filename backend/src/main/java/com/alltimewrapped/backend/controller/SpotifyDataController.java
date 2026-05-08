package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.service.SpotifyDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/spotify-data")
@RequiredArgsConstructor
public class SpotifyDataController {

    private final SpotifyDataService spotifyDataService;

    // Returns the user's top tracks from Spotify API
    @GetMapping("/{userId}/top-tracks")
    public Object getTopTracks(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "medium_term") String timeRange
    ) {
        return spotifyDataService.getTopTracks(userId, timeRange);
    }

    // Returns the user's top artists from Spotify API
    @GetMapping("/{userId}/top-artists")
    public Object getTopArtists(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "medium_term") String timeRange
    ) {
        return spotifyDataService.getTopArtists(userId, timeRange);
    }

    // Returns recently played tracks from Spotify API
    @GetMapping("/{userId}/recently-played")
    public Object getRecentlyPlayed(@PathVariable Long userId) {
        return spotifyDataService.getRecentlyPlayed(userId);
    }
}