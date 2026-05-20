package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(schema = "oltp", name = "tracks",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_spotify_track_uri", columnNames = "spotify_track_uri")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Track {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "spotify_track_uri", unique = true)
    private String spotifyTrackUri;

    @Column(name = "track_name", nullable = false)
    private String trackName;

    // Kept temporarily for compatibility with the existing import/statistics logic.
    @Column(name = "artist_name")
    private String artistName;

    // Kept temporarily for compatibility with the existing import/statistics logic.
    @Column(name = "album_name")
    private String albumName;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "image_url")
    private String imageUrl;

    @ManyToOne
    @JoinColumn(name = "album_id")
    private Album album;

    @ManyToMany
    @JoinTable(
            name = "track_artists",
            joinColumns = @JoinColumn(name = "track_id"),
            inverseJoinColumns = @JoinColumn(name = "artist_id")
    )
    @Builder.Default
    private Set<Artist> artists = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "track_genres",
            joinColumns = @JoinColumn(name = "track_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id")
    )
    @Builder.Default
    private Set<Genre> genres = new HashSet<>();
}
