package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.LocalAuthResponse;
import com.alltimewrapped.backend.dto.LocalLoginRequest;
import com.alltimewrapped.backend.dto.LocalRegisterRequest;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class LocalAuthService {

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    // Creates a local user account using username, email and password.
    public LocalAuthResponse register(LocalRegisterRequest request, String ip) {
        validateRegisterRequest(request);

        if (appUserRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Username is already used"
            );
        }

        if (appUserRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email is already used"
            );
        }

        AppUser user = new AppUser();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        AppUser savedUser = appUserRepository.save(user);

        updateLastLogin(savedUser.getId(), ip);

        return new LocalAuthResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                "manual"
        );
    }

    // Logs in a local user by checking the raw password against the saved hash.
    public LocalAuthResponse login(LocalLoginRequest request, String ip) {
        validateLoginRequest(request);

        AppUser user = appUserRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid username or password"
                ));

        if (user.getPasswordHash() == null ||
                !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid username or password"
            );
        }

        updateLastLogin(user.getId(), ip);

        return new LocalAuthResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                "manual"
        );
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

    // Keeps register validation in one place.
    private void validateRegisterRequest(LocalRegisterRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username is required"
            );
        }

        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Email is required"
            );
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password is required"
            );
        }
    }

    // Keeps login validation in one place.
    private void validateLoginRequest(LocalLoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username is required"
            );
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password is required"
            );
        }
    }
}