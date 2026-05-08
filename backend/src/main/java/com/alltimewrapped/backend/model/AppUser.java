package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_users")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // the unique Spotify account id used to identify users who log in with Spotify
    @Column(name = "spotify_user_id", unique = true, length = 100)
    private String spotifyUserId;

    // the username displayed inside the application
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    // the email associated with the user account, when Spotify provides it
    @Column(unique = true, length = 120)
    private String email;

    // the encrypted password saved for users who register with email and password
    @Column(name = "password_hash")
    private String passwordHash;

    // the date when the account was created
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}