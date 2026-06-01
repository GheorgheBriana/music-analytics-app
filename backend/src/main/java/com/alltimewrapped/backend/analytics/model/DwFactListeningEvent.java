package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(schema = "dw", name = "dw_fact_listening_event",
        indexes = {
                @Index(name = "idx_dw_fact_user_date", columnList = "user_key,date_key"),
                @Index(name = "idx_dw_fact_artist_date", columnList = "artist_key,date_key"),
                @Index(name = "idx_dw_fact_track_date", columnList = "track_key,date_key")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwFactListeningEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long factId;

    @Column(name = "original_listening_record_id", nullable = false)
    private Long originalListeningRecordId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_key", nullable = false)
    private DwDimUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "track_key", nullable = false)
    private DwDimTrack track;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_key", nullable = false)
    private DwDimArtist artist;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "album_key", nullable = false)
    private DwDimAlbum album;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "genre_key", nullable = false)
    private DwDimGenre genre;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "date_key", nullable = false)
    private DwDimDate date;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "time_key", nullable = false)
    private DwDimTime time;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "platform_key", nullable = false)
    private DwDimPlatform platform;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "source_key", nullable = false)
    private DwDimSource source;

    @Column(name = "ms_played", nullable = false)
    private Long msPlayed;

    @Column(name = "minutes_played", nullable = false)
    private Double minutesPlayed;

    @Column(name = "play_count", nullable = false)
    private Integer playCount;

    @Column(name = "skipped")
    private Boolean skipped;

    @Column(name = "completion_rate")
    private Double completionRate;
}
