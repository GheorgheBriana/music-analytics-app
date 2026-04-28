package com.alltimewrapped.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ListeningRecordDTO {

    private String trackName;
    private String artistName;
    private String albumName;
    private String spotifyTrackUri;

    private String playedAt;
    private Long msPlayed;

    private Boolean skipped;
    private String platform;
    private String countryCode;
}