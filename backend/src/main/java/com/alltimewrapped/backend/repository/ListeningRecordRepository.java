package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.dto.ListeningActivityByMonthDTO;
import com.alltimewrapped.backend.dto.ListeningActivityByYearDTO;
import com.alltimewrapped.backend.dto.TopArtistByYearDTO;
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

    long countByUserIdAndPlayedAtGreaterThanEqualAndPlayedAtLessThan(
            Long userId,
            OffsetDateTime fromDateTime,
            OffsetDateTime toDateTimeExclusive
    );

    @Query("""
            SELECT COALESCE(SUM(record.msPlayed), 0L)
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            """)
    Long getTotalMsPlayedByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT COALESCE(SUM(record.msPlayed), 0L)
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            """)
    Long getTotalMsPlayedByUserIdBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive
    );

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
            SELECT new com.alltimewrapped.backend.dto.TopTrackStatsDTO(
                record.track.trackName,
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY record.track.id, record.track.trackName, record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopTrackStatsDTO> findTopTracksByUserIdBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive,
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

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopArtistStatsDTO(
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopArtistStatsDTO> findTopArtistsByUserIdBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive,
            Pageable pageable
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.ListeningActivityByYearDTO(
                YEAR(record.playedAt),
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            GROUP BY YEAR(record.playedAt)
            ORDER BY YEAR(record.playedAt)
            """)
    List<ListeningActivityByYearDTO> findListeningActivityByYear(
            @Param("userId") Long userId
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.ListeningActivityByYearDTO(
                YEAR(record.playedAt),
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY YEAR(record.playedAt)
            ORDER BY YEAR(record.playedAt)
            """)
    List<ListeningActivityByYearDTO> findListeningActivityByYearBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.ListeningActivityByMonthDTO(
                YEAR(record.playedAt),
                MONTH(record.playedAt),
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            GROUP BY YEAR(record.playedAt), MONTH(record.playedAt)
            ORDER BY YEAR(record.playedAt), MONTH(record.playedAt)
            """)
    List<ListeningActivityByMonthDTO> findListeningActivityByMonth(
            @Param("userId") Long userId
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.ListeningActivityByMonthDTO(
                YEAR(record.playedAt),
                MONTH(record.playedAt),
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY YEAR(record.playedAt), MONTH(record.playedAt)
            ORDER BY YEAR(record.playedAt), MONTH(record.playedAt)
            """)
    List<ListeningActivityByMonthDTO> findListeningActivityByMonthBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopArtistByYearDTO(
                YEAR(record.playedAt),
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            GROUP BY YEAR(record.playedAt), record.track.artistName
            ORDER BY YEAR(record.playedAt) DESC, COUNT(record.id) DESC
            """)
    List<TopArtistByYearDTO> findTopArtistsByYear(
            @Param("userId") Long userId
    );

    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopArtistByYearDTO(
                YEAR(record.playedAt),
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY YEAR(record.playedAt), record.track.artistName
            ORDER BY YEAR(record.playedAt) DESC, COUNT(record.id) DESC
            """)
    List<TopArtistByYearDTO> findTopArtistsByYearBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive
    );
}