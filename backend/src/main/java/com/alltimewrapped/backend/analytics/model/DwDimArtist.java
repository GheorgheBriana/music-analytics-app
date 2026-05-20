package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "dw", name = "dw_dim_artist",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_artist_original_artist_id", columnNames = "original_artist_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimArtist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long artistKey;

    @Column(name = "original_artist_id", nullable = false)
    private Long originalArtistId;

    @Column(name = "artist_name", nullable = false)
    private String artistName;

    @Column(name = "spotify_artist_uri")
    private String spotifyArtistUri;
}
