package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "dw", name = "dw_dim_genre",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_genre_original_genre_id", columnNames = "original_genre_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimGenre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long genreKey;

    @Column(name = "original_genre_id", nullable = false)
    private Long originalGenreId;

    @Column(name = "genre_name", nullable = false)
    private String genreName;
}
