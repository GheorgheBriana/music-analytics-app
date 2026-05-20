package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "dw", name = "dw_dim_album",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_album_original_album_id", columnNames = "original_album_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimAlbum {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long albumKey;

    @Column(name = "original_album_id", nullable = false)
    private Long originalAlbumId;

    @Column(name = "album_name", nullable = false)
    private String albumName;

    @Column(name = "release_year")
    private Integer releaseYear;

    @Column(name = "album_type")
    private String albumType;
}
