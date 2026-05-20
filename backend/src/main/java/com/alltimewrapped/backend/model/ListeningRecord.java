package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "oltp", name = "listening_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ListeningRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "track_id", nullable = false)
    private Track track;

    @ManyToOne
    @JoinColumn(name = "import_batch_id")
    private ImportBatch importBatch;

    @Column(name = "played_at", nullable = false)
    private OffsetDateTime playedAt;

    @Column(name = "ms_played")
    private Long msPlayed;

    @Enumerated(EnumType.STRING)
    @Column(name = "source")
    private ListeningSource source;

    @Column(name = "skipped")
    private Boolean skipped;

    @Column(name = "platform")
    private String platform;

    @Column(name = "country_code")
    private String countryCode;
}
