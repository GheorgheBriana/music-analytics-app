package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.SpotifyTokenResponseDTO;
import com.alltimewrapped.backend.dto.SpotifyUserProfileDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SpotifyAuthService {

    private final AppUserRepository appUserRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SpotifyLinkService spotifyLinkService;

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

    // Builds the Spotify authorization URL for linking Spotify to a logged in manual user
    public String buildSpotifyLinkUrl(Long currentUserId) {
        return UriComponentsBuilder
                .fromUriString("https://accounts.spotify.com/authorize")
                .queryParam("client_id", clientId)
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", redirectUri)
                .queryParam(
                            "scope",
                            "user-read-email user-read-private user-top-read user-read-recently-played user-library-read playlist-read-private playlist-read-collaborative"
                )
                .queryParam("state", "link:" + currentUserId)
                .build()
                .toUriString();
    }

    // Handles the callback received from Spotify after the user logs in / links
    public AppUser handleSpotifyCallback(String code, String state, String ip) {
        SpotifyTokenResponseDTO tokenResponse = requestAccessToken(code);

        SpotifyUserProfileDTO userProfile = requestSpotifyUserProfile(tokenResponse.getAccessToken());

        AppUser user;
        if (state != null && state.startsWith("link:")) {
            Long currentUserId = Long.parseLong(state.substring("link:".length()));
            user = linkSpotifyToExistingUser(currentUserId, userProfile, tokenResponse);
        } else {
            user = saveOrUpdateSpotifyUser(userProfile, tokenResponse);
        }

        updateLastLogin(user.getId(), ip);

        // Automatically sync recently played tracks on login
        if (user.getSpotifyAccessToken() != null && !user.getSpotifyAccessToken().isBlank()) {
            try {
                spotifyLinkService.syncRecentlyPlayed(user.getId());
            } catch (Exception e) {
                // Log and ignore so login flows do not crash if Spotify Web API is temporarily down
            }
        }

        return user;
    }


    private AppUser linkSpotifyToExistingUser(
            Long currentUserId,
            SpotifyUserProfileDTO userProfile,
            SpotifyTokenResponseDTO tokenResponse) {

        AppUser user = appUserRepository.findById(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Contul curent nu există."));

        // GUARD: acest cont Spotify e deja legat la ALT user?
        appUserRepository.findBySpotifyUserId(userProfile.getId())
                .ifPresent(other -> {
                    if (!other.getId().equals(currentUserId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Acest cont Spotify este deja legat la alt utilizator.");
                    }
                });

        // Legăm: completăm câmpurile Spotify pe contul curent (NU schimbăm username/parola).
        user.setSpotifyUserId(userProfile.getId());
        if (user.getEmail() == null && userProfile.getEmail() != null) {
            user.setEmail(userProfile.getEmail());   // completăm emailul doar dacă lipsea
        }
        user.setSpotifyCountry(userProfile.getCountry());
        user.setSpotifyProduct(userProfile.getProduct());
        user.setSpotifyAccessToken(tokenResponse.getAccessToken());
        if (tokenResponse.getRefreshToken() != null) {
            user.setSpotifyRefreshToken(tokenResponse.getRefreshToken());
        }

        return appUserRepository.save(user);
    }

    private void updateLastLogin(Long userId, String ip) {
        jdbcTemplate.update("""
            INSERT INTO oltp.user_profile_sec (user_id, last_login_ip, last_login_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE
            SET last_login_ip = EXCLUDED.last_login_ip,
                last_login_at = EXCLUDED.last_login_at
            """, userId, ip);
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
                    if (existingUser.getPasswordHash() == null) {
                        existingUser.setUsername(buildUsername(userProfile));
                    }
                    existingUser.setEmail(userProfile.getEmail());
                    existingUser.setSpotifyCountry(userProfile.getCountry());
                    existingUser.setSpotifyProduct(userProfile.getProduct()); 
                    existingUser.setSpotifyAccessToken(tokenResponse.getAccessToken());  

                    if (tokenResponse.getRefreshToken() != null) {
                        existingUser.setSpotifyRefreshToken(tokenResponse.getRefreshToken());
                    }

                    return appUserRepository.save(existingUser);
                })
                .orElseGet(() -> {
                    // Try to auto-link if a manual account with the same email exists
                    if (userProfile.getEmail() != null) {
                        Optional<AppUser> existingManual = appUserRepository.findByEmail(userProfile.getEmail());
                        if (existingManual.isPresent()) {
                            AppUser user = existingManual.get();
                            user.setSpotifyUserId(userProfile.getId());
                            user.setSpotifyCountry(userProfile.getCountry());
                            user.setSpotifyProduct(userProfile.getProduct());
                            user.setSpotifyAccessToken(tokenResponse.getAccessToken());
                            if (tokenResponse.getRefreshToken() != null) {
                                user.setSpotifyRefreshToken(tokenResponse.getRefreshToken());
                            }
                            return appUserRepository.save(user);
                        }
                    }

                    AppUser user = new AppUser();

                    user.setSpotifyUserId(userProfile.getId());
                    user.setUsername(buildUsername(userProfile));
                    user.setEmail(userProfile.getEmail());
                    user.setSpotifyCountry(userProfile.getCountry());
                    user.setSpotifyProduct(userProfile.getProduct());
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