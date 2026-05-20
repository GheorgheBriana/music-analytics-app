package com.alltimewrapped.backend.analytics.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdvancedAnalyticsService {

    private final JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getMonthlyGrowth() {
        String sql = """
                WITH monthly_stats AS (
                    SELECT
                        d.year AS year,
                        d.month AS month,
                        d.month_name AS month_name,
                        COUNT(f.fact_id) AS total_plays,
                        COALESCE(SUM(f.minutes_played), 0) AS total_minutes
                    FROM dw.dw_fact_listening_event f
                    JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                    GROUP BY d.year, d.month, d.month_name
                ),
                monthly_with_previous AS (
                    SELECT
                        year,
                        month,
                        month_name,
                        total_plays,
                        total_minutes,
                        LAG(total_plays) OVER (ORDER BY year, month) AS previous_total_plays,
                        LAG(total_minutes) OVER (ORDER BY year, month) AS previous_total_minutes
                    FROM monthly_stats
                )
                SELECT
                    year AS "year",
                    month AS "month",
                    month_name AS "monthName",
                    total_plays AS "totalPlays",
                    ROUND(total_minutes::numeric, 2) AS "totalMinutes",
                    previous_total_plays AS "previousTotalPlays",
                    ROUND(previous_total_minutes::numeric, 2) AS "previousTotalMinutes",
                    CASE
                        WHEN previous_total_plays IS NULL OR previous_total_plays = 0 THEN NULL
                        ELSE ROUND((((total_plays - previous_total_plays) * 100.0) / previous_total_plays)::numeric, 2)
                    END AS "playGrowthPercent",
                    CASE
                        WHEN previous_total_minutes IS NULL OR previous_total_minutes = 0 THEN NULL
                        ELSE ROUND((((total_minutes - previous_total_minutes) * 100.0) / previous_total_minutes)::numeric, 2)
                    END AS "minutesGrowthPercent"
                FROM monthly_with_previous
                ORDER BY year, month
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getTopGenreByMonth() {
        String sql = """
                WITH genre_monthly_stats AS (
                    SELECT
                        d.year AS year,
                        d.month AS month,
                        d.month_name AS month_name,
                        g.genre_name AS genre_name,
                        COUNT(f.fact_id) AS total_plays,
                        COALESCE(SUM(f.minutes_played), 0) AS total_minutes
                    FROM dw.dw_fact_listening_event f
                    JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                    JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                    GROUP BY d.year, d.month, d.month_name, g.genre_name
                ),
                ranked_genres AS (
                    SELECT
                        year,
                        month,
                        month_name,
                        genre_name,
                        total_plays,
                        total_minutes,
                        ROW_NUMBER() OVER (
                            PARTITION BY year, month
                            ORDER BY total_plays DESC, total_minutes DESC
                        ) AS rank_position
                    FROM genre_monthly_stats
                )
                SELECT
                    year AS "year",
                    month AS "month",
                    month_name AS "monthName",
                    genre_name AS "genreName",
                    total_plays AS "totalPlays",
                    ROUND(total_minutes::numeric, 2) AS "totalMinutes",
                    rank_position AS "rankPosition"
                FROM ranked_genres
                WHERE rank_position = 1
                ORDER BY year, month
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getArtistLoyalty() {
        String sql = """
                SELECT
                    a.artist_name AS "artistName",
                    COUNT(f.fact_id) AS "totalPlays",
                    COUNT(DISTINCT f.track_key) AS "uniqueTracks",
                    ROUND((COUNT(f.fact_id) * 1.0 / NULLIF(COUNT(DISTINCT f.track_key), 0))::numeric, 2) AS "repeatIntensity",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes",
                    ROUND(AVG(f.completion_rate)::numeric, 3) AS "averageCompletionRate"
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                GROUP BY a.artist_name
                HAVING COUNT(f.fact_id) >= 3
                ORDER BY "repeatIntensity" DESC, "totalPlays" DESC
                LIMIT 10
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public Map<String, Object> getAdvancedAnalyticsOverview() {
        Map<String, Object> result = new LinkedHashMap<>();

        List<Map<String, Object>> monthlyGrowth = getMonthlyGrowth();
        List<Map<String, Object>> topGenreByMonth = getTopGenreByMonth();
        List<Map<String, Object>> artistLoyalty = getArtistLoyalty();

        result.put("monthlyGrowth", monthlyGrowth);
        result.put("topGenreByMonth", topGenreByMonth);
        result.put("artistLoyalty", artistLoyalty);

        result.put("message", "Advanced analytics reports generated successfully.");

        return result;
    }
}
