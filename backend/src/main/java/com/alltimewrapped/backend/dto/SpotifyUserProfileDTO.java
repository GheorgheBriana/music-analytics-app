package com.alltimewrapped.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class SpotifyUserProfileDTO {

    private String id;

    @JsonProperty("display_name")
    private String displayName;

    private String email;
}