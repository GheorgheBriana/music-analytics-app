package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(schema = "oltp", name = "genres",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_genre_name", columnNames = "name")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Genre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToMany(mappedBy = "genres")
    @Builder.Default
    private Set<Track> tracks = new HashSet<>();
}
