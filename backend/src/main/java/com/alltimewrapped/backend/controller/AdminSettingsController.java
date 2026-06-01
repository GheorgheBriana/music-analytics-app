package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.SystemSettingDTO;
import com.alltimewrapped.backend.service.SystemSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
public class AdminSettingsController {

    private final SystemSettingsService systemSettingsService;

    @GetMapping
    public List<SystemSettingDTO> getAll() {
        return systemSettingsService.getAllSettings();
    }

    @GetMapping("/friending")
    public Map<String, Boolean> getFriending() {
        return Map.of("enabled", systemSettingsService.isFriendingEnabled());
    }

    @PutMapping("/friending")
    public Map<String, Boolean> setFriending(@RequestHeader("X-User-Id") Long adminId,
                                             @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        systemSettingsService.setFriendingEnabled(enabled, adminId);
        return Map.of("enabled", enabled);
    }
}
