package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.SpotifyProfileResponseDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class SpotifyDataService {

    private final AppUserRepository appUserRepository;

    // Gets the user's top tracks directly from Spotify Web API
    public Object getTopTracks(Long userId, String timeRange) {
        AppUser user = getUserWithSpotifyToken(userId);

        String url = "https://api.spotify.com/v1/me/top/tracks"
                + "?time_range=" + timeRange
                + "&limit=10";

        return callSpotifyApi(user.getSpotifyAccessToken(), url);
    }

    // Gets the user's top artists directly from Spotify Web API
    public Object getTopArtists(Long userId, String timeRange) {
        AppUser user = getUserWithSpotifyToken(userId);

        String url = "https://api.spotify.com/v1/me/top/artists"
                + "?time_range=" + timeRange
                + "&limit=10";

        return callSpotifyApi(user.getSpotifyAccessToken(), url);
    }

    // Gets recently played tracks directly from Spotify Web API
    public Object getRecentlyPlayed(Long userId) {
        AppUser user = getUserWithSpotifyToken(userId);

        String url = "https://api.spotify.com/v1/me/player/recently-played?limit=10";

        return callSpotifyApi(user.getSpotifyAccessToken(), url);
    }

    // Loads the local app user and checks that a Spotify token exists
    private AppUser getUserWithSpotifyToken(Long userId) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found with id: " + userId
                ));

        if (user.getSpotifyAccessToken() == null || user.getSpotifyAccessToken().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Spotify access token not found. Please log in with Spotify again."
            );
        }

        return user;
    }

    // Calls Spotify using the user's access token
    private Object callSpotifyApi(String accessToken, String url) {
        try {
            RestTemplate restTemplate = new RestTemplate();

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);

            HttpEntity<Void> request = new HttpEntity<>(headers);

            ResponseEntity<Object> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    request,
                    Object.class
            );

            return response.getBody();
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(SpotifyDataService.class).warn("Spotify API request failed for URL {}: {}", url, e.getMessage());
            return java.util.Collections.emptyMap();
        }
    }

    // Returns the Spotify profile information saved for the logged-in user
    public SpotifyProfileResponseDTO getSpotifyProfile(Long userId) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found with id: " + userId
                ));

        return new SpotifyProfileResponseDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getSpotifyUserId(),
                user.getSpotifyCountry(),
                user.getSpotifyProduct()
        );
}
}