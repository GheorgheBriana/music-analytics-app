package com.alltimewrapped.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseIndexInitializer implements ApplicationListener<ApplicationReadyEvent> {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("[DB INITIALIZER] Starting automatic index creation for performance optimization...");
        long start = System.currentTimeMillis();

        try {
            // 1. OLTP listening_records indexes for fast dashboard loading & ETL pipeline
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user ON oltp.listening_records (user_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user_played ON oltp.listening_records (user_id, played_at)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user_id ON oltp.listening_records (user_id, id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_track_id ON oltp.listening_records (track_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_played_at ON oltp.listening_records (played_at)");

            // 2. OLTP tracks index on artist_name and album_id to resolve relations faster
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_tracks_artist ON oltp.tracks (artist_name)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_oltp_tracks_album_id ON oltp.tracks (album_id)");

            // 3. DW fact table index on original_listening_record_id (essential for fast incremental ETL pipeline checks)
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_fact_original_record ON dw.dw_fact_listening_event (original_listening_record_id)");

            // 3b. DW fact table indexes on user_key (essential for fast analytical queries by user)
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_fact_user ON dw.dw_fact_listening_event (user_key)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_fact_user_date ON dw.dw_fact_listening_event (user_key, date_key)");

            // 4. Other missing DW dimension indexes
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_user_original_id ON dw.dw_dim_user (original_user_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_track_original_id ON dw.dw_dim_track (original_track_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_artist_original_id ON dw.dw_dim_artist (original_artist_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_album_original_id ON dw.dw_dim_album (original_album_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_genre_original_id ON dw.dw_dim_genre (original_genre_id)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_date_full_date ON dw.dw_dim_date (full_date)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_time_hm ON dw.dw_dim_time (hour, minute)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_platform_lower ON dw.dw_dim_platform (LOWER(platform_name))");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_dw_dim_source_lower ON dw.dw_dim_source (LOWER(source_name))");

            // 5. Schema-agnostic track relations indexes
            String trackArtistsTable = "oltp.track_artists";
            try {
                Boolean exists = jdbcTemplate.queryForObject("SELECT to_regclass('oltp.track_artists') IS NOT NULL", Boolean.class);
                if (!Boolean.TRUE.equals(exists)) {
                    trackArtistsTable = "track_artists";
                }
            } catch (Exception e) {
                trackArtistsTable = "track_artists";
            }
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_track_artists_track_id ON " + trackArtistsTable + " (track_id)");

            String trackGenresTable = "oltp.track_genres";
            try {
                Boolean exists = jdbcTemplate.queryForObject("SELECT to_regclass('oltp.track_genres') IS NOT NULL", Boolean.class);
                if (!Boolean.TRUE.equals(exists)) {
                    trackGenresTable = "track_genres";
                }
            } catch (Exception e) {
                trackGenresTable = "track_genres";
            }
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_track_genres_track_id ON " + trackGenresTable + " (track_id)");

            // 6. Fix/Backfill missing completion rates using realistic 200k ms standard duration fallback
            log.info("[DB INITIALIZER] Backfilling missing completion rates in DW facts...");
            int updatedFacts = jdbcTemplate.update(
                "UPDATE dw.dw_fact_listening_event " +
                "SET completion_rate = LEAST(COALESCE(ms_played, 0)::double precision / 200000.0, 1.0) " +
                "WHERE completion_rate IS NULL"
            );
            log.info("[DB INITIALIZER] Backfilled {} fact records with fallback completion rate.", updatedFacts);

            log.info("[DB INITIALIZER] Performance indexes verified and created successfully in {} ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("[DB INITIALIZER] Error creating performance indexes: {}", e.getMessage(), e);
        }
    }
}
