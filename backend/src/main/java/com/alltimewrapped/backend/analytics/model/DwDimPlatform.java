package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "dw_dim_platform",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_platform_name", columnNames = "platform_name")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimPlatform {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long platformKey;

    @Column(name = "platform_name", nullable = false)
    private String platformName;
}