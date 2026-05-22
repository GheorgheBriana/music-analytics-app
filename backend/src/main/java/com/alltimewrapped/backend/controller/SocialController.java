package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ComparisonDTO;
import com.alltimewrapped.backend.dto.UserDTO;
import com.alltimewrapped.backend.service.SocialService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialController {

    private final SocialService socialService;

    @GetMapping("/users")
    public List<UserDTO> getAllUsers() {
        return socialService.getAllUsers();
    }

    @GetMapping("/compare/{userId1}/{userId2}")
    public ComparisonDTO compareUsers(@PathVariable Long userId1, @PathVariable Long userId2) {
        return socialService.compareUsers(userId1, userId2);
    }
}
