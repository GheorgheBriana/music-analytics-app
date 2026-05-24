-- Unique Indexes for Materialized Views in the dw schema
-- Required to support REFRESH MATERIALIZED VIEW CONCURRENTLY

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_listening_unique
    ON dw.mv_monthly_listening (original_user_id, year, month);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_part_of_day_stats_unique
    ON dw.mv_part_of_day_stats (original_user_id, part_of_day);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekend_vs_weekday_stats_unique
    ON dw.mv_weekend_vs_weekday_stats (original_user_id, day_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_genres_unique
    ON dw.mv_top_genres (original_user_id, genre_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_listening_heatmap_unique
    ON dw.mv_listening_heatmap (original_user_id, day_of_week, hour);
