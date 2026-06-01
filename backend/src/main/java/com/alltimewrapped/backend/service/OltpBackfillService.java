package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.Album;
import com.alltimewrapped.backend.model.Artist;
import com.alltimewrapped.backend.model.Genre;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AlbumRepository;
import com.alltimewrapped.backend.repository.ArtistRepository;
import com.alltimewrapped.backend.repository.GenreRepository;
import com.alltimewrapped.backend.repository.TrackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OltpBackfillService {

    private final TrackRepository trackRepository;
    private final ArtistRepository artistRepository;
    private final AlbumRepository albumRepository;
    private final GenreRepository genreRepository;
    private final JdbcTemplate jdbcTemplate;

    /**
     * High-performance set-based bulk backfill for track relations.
     * Processes missing relations in bulk SQL directly inside PostgreSQL, avoiding
     * the N+1 select problem, lazy relation loading, and JPA dirty checking overheads
     * that freeze or crash the server on large datasets.
     */
    @Transactional
    public Map<String, Object> backfillTrackRelations(int limit) {
        long startedAt = System.currentTimeMillis();
        
        // Count remaining before backfill
        long remainingBefore = trackRepository.countTracksNeedingBackfill();
        
        if (remainingBefore == 0) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("message", "No tracks need backfill");
            result.put("mode", "BULK_SQL");
            result.put("limit", limit);
            result.put("processedTracks", 0);
            result.put("updatedTracks", 0);
            result.put("createdAlbumLinks", 0);
            result.put("createdArtistLinks", 0);
            result.put("createdGenreLinks", 0);
            result.put("remainingBefore", 0L);
            result.put("remainingAfter", 0L);
            result.put("durationMs", System.currentTimeMillis() - startedAt);
            return result;
        }

        log.info("[OLTP BACKFILL] Starting high-performance bulk set-based backfill for {} tracks...", remainingBefore);

        // Resolve track_artists join table name dynamically (schema vs public)
        String trackArtistsTable = resolveRelationTable("oltp.track_artists", "track_artists");

        // 1. Bulk insert missing albums
        int insertedAlbums = jdbcTemplate.update("""
                INSERT INTO oltp.albums (album_name)
                SELECT DISTINCT TRIM(t.album_name)
                FROM oltp.tracks t
                WHERE t.album_id IS NULL
                  AND t.album_name IS NOT NULL
                  AND TRIM(t.album_name) != ''
                  AND NOT EXISTS (
                      SELECT 1 FROM oltp.albums a WHERE LOWER(TRIM(a.album_name)) = LOWER(TRIM(t.album_name))
                  )
                """);
        log.info("[OLTP BACKFILL] Bulk inserted {} missing albums in public/oltp", insertedAlbums);

        // 2. Bulk link tracks to albums
        int linkedAlbums = jdbcTemplate.update("""
                UPDATE oltp.tracks t
                SET album_id = a.id
                FROM oltp.albums a
                WHERE t.album_id IS NULL
                  AND t.album_name IS NOT NULL
                  AND LOWER(TRIM(a.album_name)) = LOWER(TRIM(t.album_name))
                """);
        log.info("[OLTP BACKFILL] Bulk linked {} tracks to albums", linkedAlbums);

        // 3. Bulk insert missing artists
        int insertedArtists = jdbcTemplate.update("""
                INSERT INTO oltp.artists (artist_name)
                SELECT DISTINCT TRIM(t.artist_name)
                FROM oltp.tracks t
                WHERE t.artist_name IS NOT NULL
                  AND TRIM(t.artist_name) != ''
                  AND NOT EXISTS (
                      SELECT 1 FROM oltp.artists a WHERE LOWER(TRIM(a.artist_name)) = LOWER(TRIM(t.artist_name))
                  )
                ON CONFLICT (artist_name) DO NOTHING
                """);
        log.info("[OLTP BACKFILL] Bulk inserted {} missing artists", insertedArtists);

        // 4. Bulk link tracks to artists in join table
        String linkArtistsSql = """
                INSERT INTO %s (track_id, artist_id)
                SELECT DISTINCT t.id, a.id
                FROM oltp.tracks t
                JOIN oltp.artists a ON LOWER(TRIM(a.artist_name)) = LOWER(TRIM(t.artist_name))
                WHERE t.artist_name IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM %s ta WHERE ta.track_id = t.id
                  )
                ON CONFLICT DO NOTHING
                """.formatted(trackArtistsTable, trackArtistsTable);
        int linkedArtists = jdbcTemplate.update(linkArtistsSql);
        log.info("[OLTP BACKFILL] Bulk linked {} tracks to artists in {}", linkedArtists, trackArtistsTable);

        // 5. Ensure 'unknown' genre exists
        jdbcTemplate.update("""
                INSERT INTO oltp.genres (name)
                VALUES ('unknown')
                ON CONFLICT (name) DO NOTHING
                """);

        // 6. Bulk link tracks without genres to 'unknown' genre
        int linkedGenres = jdbcTemplate.update("""
                INSERT INTO oltp.track_genres (track_id, genre_id)
                SELECT DISTINCT t.id, g.id
                FROM oltp.tracks t
                CROSS JOIN oltp.genres g
                WHERE g.name = 'unknown'
                  AND NOT EXISTS (
                      SELECT 1 FROM oltp.track_genres tg WHERE tg.track_id = t.id
                  )
                ON CONFLICT DO NOTHING
                """);
        log.info("[OLTP BACKFILL] Bulk linked {} tracks to unknown genre", linkedGenres);

        long remainingAfter = trackRepository.countTracksNeedingBackfill();
        long durationMs = System.currentTimeMillis() - startedAt;

        log.info("[OLTP BACKFILL] Bulk set-based backfill completed in {} ms. Remaining: {}", durationMs, remainingAfter);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "OLTP bulk backfill completed successfully");
        result.put("mode", "BULK_SQL");
        result.put("limit", limit);
        result.put("processedTracks", remainingBefore - remainingAfter);
        result.put("updatedTracks", linkedAlbums + linkedArtists + linkedGenres);
        result.put("createdAlbumLinks", linkedAlbums);
        result.put("createdArtistLinks", linkedArtists);
        result.put("createdGenreLinks", linkedGenres);
        result.put("remainingBefore", remainingBefore);
        result.put("remainingAfter", remainingAfter);
        result.put("durationMs", durationMs);

        return result;
    }

    private String resolveRelationTable(String preferredName, String fallbackName) {
        try {
            Boolean preferredExists = jdbcTemplate.queryForObject(
                    "SELECT to_regclass(?) IS NOT NULL",
                    Boolean.class,
                    preferredName
            );
            if (Boolean.TRUE.equals(preferredExists)) {
                return preferredName;
            }
        } catch (Exception e) {
            // ignore
        }
        return fallbackName;
    }
}