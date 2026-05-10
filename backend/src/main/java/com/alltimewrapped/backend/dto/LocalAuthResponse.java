package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LocalAuthResponse {

    private Long userId;
    private String username;
    private String email;
    private String authType;
}