package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
        name = "artists",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_artist_name", columnNames = "artist_name")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Artist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "spotify_artist_uri")
    private String spotifyArtistUri;

    @Column(name = "artist_name", nullable = false)
    private String artistName;

    @ManyToMany(mappedBy = "artists")
    @Builder.Default
    private Set<Track> tracks = new HashSet<>();
}