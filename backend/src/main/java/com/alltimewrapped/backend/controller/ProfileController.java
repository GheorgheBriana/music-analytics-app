package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ChangePasswordRequest;
import com.alltimewrapped.backend.dto.ProfileResponse;
import com.alltimewrapped.backend.dto.ProfileUpdateRequest;
import com.alltimewrapped.backend.dto.PublicProfileResponse;
import com.alltimewrapped.backend.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * ProfileController
 * ----------------------------------------------------------------------------
 * Demonstrează fragmentarea verticală MODBD prin profilul utilizatorului.
 *
 * GET  /api/profile/me                 -> profilul propriu (include fragmentul sensibil)
 * PUT  /api/profile/me                 -> actualizare prin view (trigger INSTEAD OF)
 * GET  /api/profile/{userId}           -> profilul PUBLIC al altcuiva (fără date sensibile)
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    // --- Profilul propriu (cu fragment sensibil) ---
    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getOwnProfile(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(profileService.getOwnProfile(userId));
    }

    // --- Actualizare profil propriu (scrie prin view -> trigger fragmentează) ---
    @PutMapping("/me")
    public ResponseEntity<ProfileResponse> updateOwnProfile(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody ProfileUpdateRequest req) {
        return ResponseEntity.ok(profileService.updateProfile(userId, req));
    }

    // --- Profilul public al altui user (NICIODATĂ date sensibile) ---
    @GetMapping("/{targetUserId}")
    public ResponseEntity<PublicProfileResponse> getPublicProfile(
            @RequestHeader("X-User-Id") Long viewerUserId,
            @PathVariable Long targetUserId) {
        try {
            return ResponseEntity.ok(
                    profileService.getPublicProfile(targetUserId, viewerUserId));
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilizatorul nu exista");
        }
    }

    // --- Schimbare parola (doar pentru conturile locale/manuale) ---
    @PutMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody ChangePasswordRequest req) {
        profileService.changePassword(userId, req.oldPassword(), req.newPassword());
        return ResponseEntity.ok(Map.of("message", "Parola a fost modificata cu succes"));
    }
}
