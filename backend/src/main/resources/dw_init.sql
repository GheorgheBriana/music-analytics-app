CREATE SCHEMA IF NOT EXISTS oltp;
CREATE SCHEMA IF NOT EXISTS dw;

-- Drop normal table if Hibernate created it
DROP TABLE IF EXISTS dw.dw_fact_listening_event CASCADE;

-- Create partitioned fact table
CREATE TABLE dw.dw_fact_listening_event (
    fact_id BIGSERIAL,
    original_listening_record_id BIGINT NOT NULL,
    user_key BIGINT NOT NULL,
    track_key BIGINT NOT NULL,
    artist_key BIGINT NOT NULL,
    album_key BIGINT NOT NULL,
    genre_key BIGINT NOT NULL,
    date_key BIGINT NOT NULL,
    time_key BIGINT NOT NULL,
    platform_key BIGINT NOT NULL,
    source_key BIGINT NOT NULL,
    ms_played BIGINT NOT NULL,
    minutes_played DOUBLE PRECISION NOT NULL,
    play_count INTEGER NOT NULL,
    skipped BOOLEAN,
    completion_rate DOUBLE PRECISION,
    PRIMARY KEY (fact_id, date_key)
) PARTITION BY RANGE (date_key);

-- Create partitions for years 2023, 2024, 2025
CREATE TABLE dw.dw_fact_listening_event_2023 PARTITION OF dw.dw_fact_listening_event
    FOR VALUES FROM (20230101) TO (20240101);

CREATE TABLE dw.dw_fact_listening_event_2024 PARTITION OF dw.dw_fact_listening_event
    FOR VALUES FROM (20240101) TO (20250101);

CREATE TABLE dw.dw_fact_listening_event_2025 PARTITION OF dw.dw_fact_listening_event
    FOR VALUES FROM (20250101) TO (20260101);

-- Default partition for other dates
CREATE TABLE dw.dw_fact_listening_event_default PARTITION OF dw.dw_fact_listening_event DEFAULT;

-- Indexes for DW
CREATE INDEX idx_dw_fact_date ON dw.dw_fact_listening_event(date_key);
CREATE INDEX idx_dw_fact_artist ON dw.dw_fact_listening_event(artist_key);
CREATE INDEX idx_dw_fact_track ON dw.dw_fact_listening_event(track_key);
CREATE INDEX idx_dw_fact_genre ON dw.dw_fact_listening_event(genre_key);

-- Materialized Views for BI Reports
DROP MATERIALIZED VIEW IF EXISTS dw.mv_monthly_listening;
CREATE MATERIALIZED VIEW dw.mv_monthly_listening AS
SELECT
    d.year AS year,
    d.month AS month,
    d.month_name AS month_name,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_part_of_day_stats;
CREATE MATERIALIZED VIEW dw.mv_part_of_day_stats AS
SELECT
    t.part_of_day AS part_of_day,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
GROUP BY t.part_of_day
ORDER BY total_minutes DESC;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_weekend_vs_weekday_stats;
CREATE MATERIALIZED VIEW dw.mv_weekend_vs_weekday_stats AS
SELECT
    CASE WHEN d.is_weekend = true THEN 'weekend' ELSE 'weekday' END AS day_type,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
GROUP BY d.is_weekend
ORDER BY total_minutes DESC;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_top_genres;
CREATE MATERIALIZED VIEW dw.mv_top_genres AS
SELECT
    g.genre_name AS genre_name,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
GROUP BY g.genre_name
ORDER BY total_minutes DESC
LIMIT 50;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_listening_heatmap;
CREATE MATERIALIZED VIEW dw.mv_listening_heatmap AS
SELECT
    d.day_of_week AS day_of_week,
    d.day_name AS day_name,
    t.hour AS hour,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
GROUP BY d.day_of_week, d.day_name, t.hour
ORDER BY d.day_of_week, t.hour;

