DROP MATERIALIZED VIEW IF EXISTS dw.mv_monthly_listening;
CREATE MATERIALIZED VIEW dw.mv_monthly_listening AS
SELECT
    u.original_user_id AS original_user_id,
    d.year AS year,
    d.month AS month,
    d.month_name AS month_name,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
GROUP BY u.original_user_id, d.year, d.month, d.month_name
ORDER BY d.year, d.month;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_part_of_day_stats;
CREATE MATERIALIZED VIEW dw.mv_part_of_day_stats AS
SELECT
    u.original_user_id AS original_user_id,
    t.part_of_day AS part_of_day,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
GROUP BY u.original_user_id, t.part_of_day
ORDER BY total_minutes DESC;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_weekend_vs_weekday_stats;
CREATE MATERIALIZED VIEW dw.mv_weekend_vs_weekday_stats AS
SELECT
    u.original_user_id AS original_user_id,
    CASE WHEN d.is_weekend = true THEN 'weekend' ELSE 'weekday' END AS day_type,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
GROUP BY u.original_user_id, d.is_weekend
ORDER BY total_minutes DESC;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_top_genres;
CREATE MATERIALIZED VIEW dw.mv_top_genres AS
SELECT
    u.original_user_id AS original_user_id,
    g.genre_name AS genre_name,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
GROUP BY u.original_user_id, g.genre_name
ORDER BY total_minutes DESC
LIMIT 50;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_listening_heatmap;
CREATE MATERIALIZED VIEW dw.mv_listening_heatmap AS
SELECT
    u.original_user_id AS original_user_id,
    d.day_of_week AS day_of_week,
    d.day_name AS day_name,
    t.hour AS hour,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
GROUP BY u.original_user_id, d.day_of_week, d.day_name, t.hour
ORDER BY d.day_of_week, t.hour;
