package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(schema = "oltp", name = "albums")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Album {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "spotify_album_uri")
    private String spotifyAlbumUri;

    @Column(name = "album_name", nullable = false)
    private String albumName;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    @Column(name = "album_type")
    private String albumType;

    @OneToMany(mappedBy = "album")
    @Builder.Default
    private List<Track> tracks = new ArrayList<>();
}
