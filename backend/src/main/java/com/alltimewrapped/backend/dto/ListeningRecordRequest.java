package com.alltimewrapped.backend.dto;

import com.alltimewrapped.backend.model.ListeningSource;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class ListeningRecordRequest {

    // we send only the user id in JSON, not the full user details
    private Long userId;

    private String spotifyTrackUri;

    private String trackName;

    private String artistName;

    private String albumName;

    private OffsetDateTime playedAt;

    private Long msPlayed;

    private ListeningSource source;

    private Boolean skipped;

    private String platform;

    private String countryCode;

}

