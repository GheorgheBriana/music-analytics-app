package com.alltimewrapped.backend.dto;

public record ProfileUpdateRequest(
    String bio,
    String favoriteGenre,
    String avatarUrl
) {}
