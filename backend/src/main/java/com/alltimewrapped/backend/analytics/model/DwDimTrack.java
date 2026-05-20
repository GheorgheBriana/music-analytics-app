package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "dw", name = "dw_dim_track",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_track_original_track_id", columnNames = "original_track_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long trackKey;

    @Column(name = "original_track_id", nullable = false)
    private Long originalTrackId;

    @Column(name = "spotify_track_uri")
    private String spotifyTrackUri;

    @Column(name = "track_name", nullable = false)
    private String trackName;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "image_url")
    private String imageUrl;
}
