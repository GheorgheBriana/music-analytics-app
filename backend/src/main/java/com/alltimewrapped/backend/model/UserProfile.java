package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "oltp", name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private AppUser user;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "country")
    private String country;

    @Column(name = "preferred_language")
    private String preferredLanguage;
}
