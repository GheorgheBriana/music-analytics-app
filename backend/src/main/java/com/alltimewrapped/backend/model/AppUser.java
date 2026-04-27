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

    // the username chosen by the user
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    // the email used for login and communication
    @Column(nullable = false, unique = true, length = 120)
    private String email;

    // the encrypted password saved in the database
    @Column(name = "password_hash", nullable = false)
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