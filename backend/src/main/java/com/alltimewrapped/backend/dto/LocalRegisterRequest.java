package com.alltimewrapped.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LocalRegisterRequest {

    private String username;
    private String email;
    private String password;
}