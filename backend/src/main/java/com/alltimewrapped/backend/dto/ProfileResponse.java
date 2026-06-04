package com.alltimewrapped.backend.dto;

public record ProfileResponse(
    long userId,
    String username,
    String email,
    String role,
    String bio,
    String favoriteGenre,
    String avatarUrl,
    String lastLoginIp,
    String lastLoginAt,
    boolean isLocal,
    ProfileStats stats
) {}
