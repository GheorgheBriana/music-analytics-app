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

    private String factUserWhere(Long userId) {
        return userId != null ? " JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? " : "";
    }

    private Object[] params(Long userId) {
        return userId != null ? new Object[]{userId} : new Object[]{};
    }

    public List<Map<String, Object>> getMonthlyGrowth(Long userId) {
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
                    """ + factUserWhere(userId) + """
                    GROUP BY d.year, d.month, d.month_name
                ),
                monthly_with_analytics AS (
                    SELECT
                        year,
                        month,
                        month_name,
                        total_plays,
                        total_minutes,
                        LAG(total_plays) OVER (ORDER BY year, month) AS previous_total_plays,
                        LAG(total_minutes) OVER (ORDER BY year, month) AS previous_total_minutes,
                        AVG(total_minutes) OVER (ORDER BY year, month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3_months
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
                    ROUND(moving_avg_3_months::numeric, 2) AS "movingAvg3Months",
                    CASE
                        WHEN previous_total_plays IS NULL OR previous_total_plays < 20 THEN NULL
                        ELSE ROUND((((total_plays - previous_total_plays) * 100.0) / previous_total_plays)::numeric, 2)
                    END AS "playGrowthPercent",
                    CASE
                        WHEN previous_total_minutes IS NULL OR previous_total_minutes = 0 THEN NULL
                        ELSE ROUND((((total_minutes - previous_total_minutes) * 100.0) / previous_total_minutes)::numeric, 2)
                    END AS "minutesGrowthPercent"
                FROM monthly_with_analytics
                ORDER BY year, month
                """;

        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getTopGenreByMonth(Long userId) {
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
                    """ + factUserWhere(userId) + """
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

        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getArtistRankingEvolution(Long userId) {
        String sql = """
                WITH artist_monthly AS (
                    SELECT
                        d.year AS year,
                        d.month AS month,
                        d.month_name AS month_name,
                        a.artist_name AS artist_name,
                        COUNT(f.fact_id) AS total_plays,
                        COALESCE(SUM(f.minutes_played), 0) AS total_minutes
                    FROM dw.dw_fact_listening_event f
                    JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                    JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                    """ + factUserWhere(userId) + """
                    GROUP BY d.year, d.month, d.month_name, a.artist_name
                ),
                ranked_artists AS (
                    SELECT
                        year,
                        month,
                        month_name,
                        artist_name,
                        total_plays,
                        total_minutes,
                        DENSE_RANK() OVER (
                            PARTITION BY year, month
                            ORDER BY total_plays DESC, total_minutes DESC
                        ) AS rank_position
                    FROM artist_monthly
                )
                SELECT
                    year AS "year",
                    month AS "month",
                    month_name AS "monthName",
                    artist_name AS "artistName",
                    total_plays AS "totalPlays",
                    ROUND(total_minutes::numeric, 2) AS "totalMinutes",
                    rank_position AS "rankPosition"
                FROM ranked_artists
                WHERE rank_position <= 3
                ORDER BY year, month, rank_position
                """;

        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getArtistLoyalty(Long userId) {
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
                """ + factUserWhere(userId) + """
                GROUP BY a.artist_name
                HAVING COUNT(f.fact_id) >= 3
                ORDER BY "repeatIntensity" DESC, "totalPlays" DESC
                LIMIT 10
                """;

        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public Map<String, Object> getAdvancedAnalyticsOverview(Long userId) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("monthlyGrowth", getMonthlyGrowth(userId));
        result.put("topGenreByMonth", getTopGenreByMonth(userId));
        result.put("artistLoyalty", getArtistLoyalty(userId));
        result.put("artistRankingEvolution", getArtistRankingEvolution(userId));
        result.put("message", "Advanced analytics reports generated successfully.");

        return result;
    }

    public List<Map<String, Object>> getRollupListening(Long userId) {
        String userFilter = userId != null
                ? " JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? "
                : " WHERE 1=1 ";

        String sql = """
                SELECT
                    d.year                                                AS "year",
                    d.month                                               AS "month",
                    d.month_name                                          AS "monthName",
                    g.genre_name                                          AS "genreName",
                    COUNT(f.fact_id)                                      AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes",
                    GROUPING(d.year)                                      AS "isYearSubtotal",
                    GROUPING(d.month)                                     AS "isMonthSubtotal",
                    GROUPING(g.genre_name)                                AS "isGenreSubtotal"
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                """ + userFilter + """
                GROUP BY ROLLUP(d.year, (d.month, d.month_name), g.genre_name)
                ORDER BY
                    d.year       NULLS LAST,
                    d.month      NULLS LAST,
                    g.genre_name NULLS LAST
                """;

        if (userId != null) {
            return jdbcTemplate.queryForList(sql, userId);
        }

        return jdbcTemplate.queryForList(sql);
    }
}
