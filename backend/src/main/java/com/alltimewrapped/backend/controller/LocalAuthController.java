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
    public LocalAuthResponse register(@RequestBody LocalRegisterRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String ip = getClientIp(httpRequest);
        return localAuthService.register(request, ip);
    }

    // Logs in an existing local user.
    @PostMapping("/login")
    public LocalAuthResponse login(@RequestBody LocalLoginRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String ip = getClientIp(httpRequest);
        return localAuthService.login(request, ip);
    }

    private String getClientIp(jakarta.servlet.http.HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}