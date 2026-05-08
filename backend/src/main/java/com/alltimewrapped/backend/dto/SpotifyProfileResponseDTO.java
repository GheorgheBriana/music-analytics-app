package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SpotifyProfileResponseDTO {

    private Long id;
    private String username;
    private String email;
    private String spotifyUserId;
    private String spotifyCountry;
    private String spotifyProduct;
}