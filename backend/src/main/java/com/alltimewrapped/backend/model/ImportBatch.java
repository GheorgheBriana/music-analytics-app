package com.alltimewrapped.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(schema = "oltp", name = "import_batches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "import_started_at", nullable = false)
    private OffsetDateTime importStartedAt;

    @Column(name = "import_finished_at")
    private OffsetDateTime importFinishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportStatus status;

    @Column(name = "total_records")
    private int totalRecords;

    @Column(name = "successful_records")
    private int successfulRecords;

    @Column(name = "failed_records")
    private int failedRecords;

    @OneToMany(mappedBy = "importBatch")
    @Builder.Default
    private List<ListeningRecord> listeningRecords = new ArrayList<>();
}
