package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.SpotifyTokenResponseDTO;
import com.alltimewrapped.backend.dto.SpotifyUserProfileDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Base64;

@Service
@RequiredArgsConstructor
public class SpotifyAuthService {

    private final AppUserRepository appUserRepository;

    @Value("${spotify.client-id}")
    private String clientId;

    @Value("${spotify.client-secret}")
    private String clientSecret;

    @Value("${spotify.redirect-uri}")
    private String redirectUri;

    // Builds the Spotify authorization URL where the user is redirected to log in
    public String buildSpotifyLoginUrl() {
        return UriComponentsBuilder
                .fromUriString("https://accounts.spotify.com/authorize")
                .queryParam("client_id", clientId)
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", redirectUri)
                .queryParam(
                            "scope",
                            "user-read-email user-read-private user-top-read user-read-recently-played user-library-read playlist-read-private playlist-read-collaborative"
                )
                .build()
                .toUriString();
    }

    // Handles the callback code received from Spotify and saves the logged-in user
    public AppUser handleSpotifyCallback(String code) {
        SpotifyTokenResponseDTO tokenResponse = requestAccessToken(code);

        SpotifyUserProfileDTO userProfile = requestSpotifyUserProfile(tokenResponse.getAccessToken());

        return saveOrUpdateSpotifyUser(userProfile, tokenResponse);
    }

    // Exchanges the authorization code for an access token
    private SpotifyTokenResponseDTO requestAccessToken(String code) {
        RestTemplate restTemplate = new RestTemplate();

        String credentials = clientId + ":" + clientSecret;
        String encodedCredentials = Base64.getEncoder().encodeToString(credentials.getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("Authorization", "Basic " + encodedCredentials);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", redirectUri);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        ResponseEntity<SpotifyTokenResponseDTO> response = restTemplate.exchange(
                "https://accounts.spotify.com/api/token",
                HttpMethod.POST,
                request,
                SpotifyTokenResponseDTO.class
        );

        return response.getBody();
    }

    // Uses the access token to retrieve the Spotify profile of the authenticated user
    private SpotifyUserProfileDTO requestSpotifyUserProfile(String accessToken) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<SpotifyUserProfileDTO> response = restTemplate.exchange(
                "https://api.spotify.com/v1/me",
                HttpMethod.GET,
                request,
                SpotifyUserProfileDTO.class
        );

        return response.getBody();
    }

    // Saves a new Spotify user or returns the existing one if it was already created
    private AppUser saveOrUpdateSpotifyUser(
            SpotifyUserProfileDTO userProfile,
            SpotifyTokenResponseDTO tokenResponse
    ) {
        return appUserRepository.findBySpotifyUserId(userProfile.getId())
                .map(existingUser -> {
                    existingUser.setUsername(buildUsername(userProfile));
                    existingUser.setEmail(userProfile.getEmail());
                    existingUser.setSpotifyAccessToken(tokenResponse.getAccessToken());

                    if (tokenResponse.getRefreshToken() != null) {
                        existingUser.setSpotifyRefreshToken(tokenResponse.getRefreshToken());
                    }

                    return appUserRepository.save(existingUser);
                })
                .orElseGet(() -> {
                    AppUser user = new AppUser();

                    user.setSpotifyUserId(userProfile.getId());
                    user.setUsername(buildUsername(userProfile));
                    user.setEmail(userProfile.getEmail());
                    user.setSpotifyAccessToken(tokenResponse.getAccessToken());
                    user.setSpotifyRefreshToken(tokenResponse.getRefreshToken());

                    return appUserRepository.save(user);
                });
    }

    // Creates a safe username from the Spotify display name or user id
    private String buildUsername(SpotifyUserProfileDTO userProfile) {
        if (userProfile.getDisplayName() != null && !userProfile.getDisplayName().isBlank()) {
            return userProfile.getDisplayName();
        }

        return "spotify_user_" + userProfile.getId();
    }
}