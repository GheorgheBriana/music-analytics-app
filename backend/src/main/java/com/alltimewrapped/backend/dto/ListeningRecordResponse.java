package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
@AllArgsConstructor
public class ListeningRecordResponse {

    private Long id;

    private String trackName;
    private String artistName;
    private String albumName;

    private OffsetDateTime playedAt;
    private Long msPlayed;

    private String source;
    private Boolean skipped;
    private String platform;
    private String countryCode;
}