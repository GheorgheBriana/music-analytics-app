package com.alltimewrapped.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LocalLoginRequest {

    private String username;
    private String password;
}