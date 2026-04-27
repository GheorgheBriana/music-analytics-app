package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "listening_records")
@Getter
@Setter
@NoArgsConstructor
public class ListeningRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // the user who owns this listening record
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    // the track that was listened to
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", nullable = false)
    private Track track;

    // the moment when the song was played
    @Column(name = "played_at", nullable = false)
    private OffsetDateTime playedAt;

    // how long was the song played, in milliseconds
    @Column(name = "ms_played", nullable = false)
    private Long msPlayed;

    // the source of the listening data: Spotify or manual upload
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 50)
    private ListeningSource source;

    // shows if the song was skipped before it finished
    @Column(name = "skipped")
    private Boolean skipped;

    // the platform used for listening, example: Android, iOS, Web Player
    @Column(name = "platform", length = 50)
    private String platform;

    // the country where the song was played, if available
    @Column(name = "country_code", length = 10)
    private String countryCode;

    // the date when this record was saved in our application
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if(createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
