package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.dto.TopArtistStatsDTO;
import com.alltimewrapped.backend.dto.TopTrackStatsDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface ListeningRecordRepository extends JpaRepository<ListeningRecord, Long> {

    List<ListeningRecord> findByUser(AppUser user);

    List<ListeningRecord> findByUserId(Long userId);

    List<ListeningRecord> findByUserOrderByPlayedAtDesc(AppUser user);

    boolean existsByUserIdAndTrackIdAndPlayedAt(Long userId, Long trackId, OffsetDateTime playedAt);

    long countByUserId(Long userId);

    @Query("""
            SELECT COALESCE(SUM(record.msPlayed), 0L)
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            """)
    Long getTotalMsPlayedByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopTrackStatsDTO(
                record.track.trackName,
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            GROUP BY record.track.id, record.track.trackName, record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopTrackStatsDTO> findTopTracksByUserId(
            @Param("userId") Long userId,
            Pageable pageable
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopArtistStatsDTO(
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            GROUP BY record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopArtistStatsDTO> findTopArtistsByUserId(
            @Param("userId") Long userId,
            Pageable pageable
    );
}