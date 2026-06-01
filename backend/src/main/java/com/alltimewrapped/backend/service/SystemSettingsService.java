package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.SystemSettingDTO;
import com.alltimewrapped.backend.model.SystemSetting;
import com.alltimewrapped.backend.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SystemSettingsService {

    public static final String KEY_FRIENDING_ENABLED = "friending_enabled";

    private final SystemSettingRepository repo;

    @Transactional(readOnly = true)
    public boolean isFriendingEnabled() {
        return repo.findById(KEY_FRIENDING_ENABLED)
            .map(s -> "true".equalsIgnoreCase(s.getValue()))
            .orElse(true);   // default permis
    }

    @Transactional
    public void setFriendingEnabled(boolean enabled, Long adminUserId) {
        SystemSetting s = repo.findById(KEY_FRIENDING_ENABLED)
            .orElseGet(() -> {
                SystemSetting fresh = new SystemSetting();
                fresh.setKey(KEY_FRIENDING_ENABLED);
                fresh.setDescription("Allow users to send friend requests and compare profiles");
                return fresh;
            });
        s.setValue(String.valueOf(enabled));
        s.setUpdatedAt(OffsetDateTime.now());
        s.setUpdatedBy(adminUserId);
        repo.save(s);
    }

    @Transactional(readOnly = true)
    public List<SystemSettingDTO> getAllSettings() {
        return repo.findAll().stream()
            .map(s -> new SystemSettingDTO(s.getKey(), s.getValue(), s.getDescription()))
            .toList();
    }
}
