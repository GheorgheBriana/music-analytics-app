package com.alltimewrapped.backend.dto;

public record PublicProfileResponse(
    long userId,
    String username,
    String role,
    String bio,
    String favoriteGenre,
    String avatarUrl,
    ProfileStats stats,
    boolean isFriend
) {}
