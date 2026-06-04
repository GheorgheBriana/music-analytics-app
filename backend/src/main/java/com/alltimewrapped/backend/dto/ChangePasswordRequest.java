package com.alltimewrapped.backend.dto;

public record ChangePasswordRequest(
    String oldPassword,
    String newPassword
) {}
