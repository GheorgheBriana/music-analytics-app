package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tracks")
@Getter
@Setter
public class Track {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // spotify track id, if the track comes from Spotify
    @Column(name = "track_name", nullable = false)
    private String trackName;

    // artist name
    @Column(name = "artist_name", nullable = false)
    private String artistName;

    // album, if available
    @Column(name = "album_name")
    private String albumName;

    // the duration of the song, in milliseconds
    @Column(name = "duration_ms")
    private Integer durationMs;

    // URL of the album cover page, if available later from Spotify API
    @Column(name = "image_url")
    private String imageUrl;

}
