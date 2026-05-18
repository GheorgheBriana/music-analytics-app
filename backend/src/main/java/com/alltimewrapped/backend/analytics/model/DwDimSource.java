package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "dw_dim_source",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_source_name", columnNames = "source_name")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sourceKey;

    @Column(name = "source_name", nullable = false)
    private String sourceName;
}