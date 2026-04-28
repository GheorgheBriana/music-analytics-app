package com.alltimewrapped.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class SpotifyListeningDTO {

    private String ts;
    private String platform;
    private Long ms_played;
    private String conn_country;

    private String master_metadata_track_name;
    private String master_metadata_album_artist_name;
    private String master_metadata_album_album_name;

    private String spotify_track_uri;
    private Boolean skipped;
}