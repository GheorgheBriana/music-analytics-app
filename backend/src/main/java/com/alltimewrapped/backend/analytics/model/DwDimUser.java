package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "dw_dim_user",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_user_original_user_id", columnNames = "original_user_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userKey;

    @Column(name = "original_user_id", nullable = false)
    private Long originalUserId;

    @Column(nullable = false)
    private String username;

    @Column
    private String email;

    @Column
    private String country;
}