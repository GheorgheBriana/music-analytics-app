package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.LocalAuthResponse;
import com.alltimewrapped.backend.dto.LocalLoginRequest;
import com.alltimewrapped.backend.dto.LocalRegisterRequest;
import com.alltimewrapped.backend.service.LocalAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/local")
@RequiredArgsConstructor
public class LocalAuthController {

    private final LocalAuthService localAuthService;

    // Creates a local account for users who do not want to connect Spotify.
    @PostMapping("/register")
    public LocalAuthResponse register(@RequestBody LocalRegisterRequest request) {
        return localAuthService.register(request);
    }

    // Logs in an existing local user.
    @PostMapping("/login")
    public LocalAuthResponse login(@RequestBody LocalLoginRequest request) {
        return localAuthService.login(request);
    }
}