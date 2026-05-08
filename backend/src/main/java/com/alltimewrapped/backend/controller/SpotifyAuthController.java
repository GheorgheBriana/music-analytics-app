package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.service.SpotifyAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/auth/spotify")
@RequiredArgsConstructor
public class SpotifyAuthController {

    private final SpotifyAuthService spotifyAuthService;

    @Value("${spotify.frontend-redirect-uri}")
    private String frontendRedirectUri;

    // Redirects the user to the Spotify authorization page
    @GetMapping("/login")
    public ResponseEntity<Void> loginWithSpotify() {
        String spotifyLoginUrl = spotifyAuthService.buildSpotifyLoginUrl();

        return ResponseEntity
                .status(302)
                .header(HttpHeaders.LOCATION, spotifyLoginUrl)
                .build();
    }

    // Handles the callback received from Spotify after the user logs in
    @GetMapping("/callback")
    public ResponseEntity<Void> handleSpotifyCallback(@RequestParam String code) {
        AppUser user = spotifyAuthService.handleSpotifyCallback(code);

        String redirectUrl = frontendRedirectUri + "?userId=" + user.getId();

        return ResponseEntity
                .status(302)
                .location(URI.create(redirectUrl))
                .build();
    }
}