package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface ListeningRecordRepository extends JpaRepository<ListeningRecord, Long> {

    // Basic queries used to load listening records for a specific user.
    List<ListeningRecord> findByUser(AppUser user);

    List<ListeningRecord> findByUserId(Long userId);

    List<ListeningRecord> findByUserOrderByPlayedAtDesc(AppUser user);

    // Used during import to avoid saving the same listening event multiple times.
    boolean existsByUserIdAndTrackIdAndPlayedAt(Long userId, Long trackId, OffsetDateTime playedAt);

    // Used by recommender to check if user already listened to an artist
    boolean existsByUserIdAndTrack_ArtistName(Long userId, String artistName);

    // Counts all imported listening records for one user.
    long countByUserId(Long userId);

    // Counts listening records only inside a selected date range.
    long countByUserIdAndPlayedAtGreaterThanEqualAndPlayedAtLessThan(
            Long userId,
            OffsetDateTime fromDateTime,
            OffsetDateTime toDateTimeExclusive
    );

    // Calculates the total listening time for the full imported history.
    @Query("""
            SELECT COALESCE(SUM(record.msPlayed), 0L)
            FROM ListeningRecord record
            WHERE record.user.id = :userId
            """)
    Long getTotalMsPlayedByUserId(@Param("userId") Long userId);

    // Calculates the total listening time only inside the selected date range.
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

    // Returns the most played tracks for the full imported history.
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

    // Returns the most played tracks only inside the selected date range.
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

    // Returns the most played artists for the full imported history.
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

    // Returns the most played artists only inside the selected date range.
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

    // Returns the most played albums for the full imported history.
    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopAlbumStatsDTO(
                record.track.albumName,
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.track.albumName IS NOT NULL
              AND record.track.albumName <> ''
            GROUP BY record.track.albumName, record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopAlbumStatsDTO> findTopAlbumsByUserId(
            @Param("userId") Long userId,
            Pageable pageable
    );

    // Returns the most played albums only inside the selected date range.
    @Query("""
            SELECT new com.alltimewrapped.backend.dto.TopAlbumStatsDTO(
                record.track.albumName,
                record.track.artistName,
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
              AND record.track.albumName IS NOT NULL
              AND record.track.albumName <> ''
            GROUP BY record.track.albumName, record.track.artistName
            ORDER BY COUNT(record.id) DESC
            """)
    List<TopAlbumStatsDTO> findTopAlbumsByUserIdBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive,
            Pageable pageable
    );

    // Groups listening activity by year for the full imported history.
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

    // Groups listening activity by year only inside the selected date range.
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

    // Groups listening activity by month for the full imported history.
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

    // Groups listening activity by month only inside the selected date range.
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

    // Groups listening activity by day for the selected period.
    @Query("""
            SELECT new com.alltimewrapped.backend.dto.DailyActivityDTO(
                YEAR(record.playedAt),
                MONTH(record.playedAt),
                DAY(record.playedAt),
                COUNT(record.id),
                COALESCE(SUM(record.msPlayed), 0L)
            )
            FROM ListeningRecord record
            WHERE record.user.id = :userId
              AND record.playedAt >= :fromDateTime
              AND record.playedAt < :toDateTimeExclusive
            GROUP BY YEAR(record.playedAt), MONTH(record.playedAt), DAY(record.playedAt)
            ORDER BY YEAR(record.playedAt), MONTH(record.playedAt), DAY(record.playedAt)
            """)
    List<DailyActivityDTO> findDailyActivityByUserIdBetween(
            @Param("userId") Long userId,
            @Param("fromDateTime") OffsetDateTime fromDateTime,
            @Param("toDateTimeExclusive") OffsetDateTime toDateTimeExclusive
    );

    // Returns yearly artist statistics for the full imported history.
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

    // Returns yearly artist statistics only inside the selected date range.
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