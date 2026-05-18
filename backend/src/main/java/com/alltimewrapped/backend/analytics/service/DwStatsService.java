package com.alltimewrapped.backend.analytics.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DwStatsService {

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> getWarehouseSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();

        Long totalEvents = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dw_fact_listening_event",
                Long.class
        );

        Double totalMinutes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(minutes_played), 0) FROM dw_fact_listening_event",
                Double.class
        );

        Long uniqueTracks = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT track_key) FROM dw_fact_listening_event",
                Long.class
        );

        Long uniqueArtists = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT artist_key) FROM dw_fact_listening_event",
                Long.class
        );

        Long uniqueGenres = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT genre_key) FROM dw_fact_listening_event",
                Long.class
        );

        summary.put("totalEvents", totalEvents);
        summary.put("totalMinutes", totalMinutes);
        summary.put("uniqueTracks", uniqueTracks);
        summary.put("uniqueArtists", uniqueArtists);
        summary.put("uniqueGenres", uniqueGenres);

        return summary;
    }

    public List<Map<String, Object>> getMonthlyListening() {
        String sql = """
                SELECT
                    d.year AS "year",
                    d.month AS "month",
                    d.month_name AS "monthName",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_date d ON f.date_key = d.date_key
                GROUP BY d.year, d.month, d.month_name
                ORDER BY d.year, d.month
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getPartOfDayStats() {
        String sql = """
                SELECT
                    t.part_of_day AS "partOfDay",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_time t ON f.time_key = t.time_key
                GROUP BY t.part_of_day
                ORDER BY "totalMinutes" DESC
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getWeekendVsWeekdayStats() {
        String sql = """
                SELECT
                    CASE
                        WHEN d.is_weekend = true THEN 'weekend'
                        ELSE 'weekday'
                    END AS "dayType",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_date d ON f.date_key = d.date_key
                GROUP BY d.is_weekend
                ORDER BY "totalMinutes" DESC
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getTopGenres() {
        String sql = """
                SELECT
                    g.genre_name AS "genreName",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_genre g ON f.genre_key = g.genre_key
                GROUP BY g.genre_name
                ORDER BY "totalMinutes" DESC
                LIMIT 10
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getCompletionRateByArtist() {
        String sql = """
                SELECT
                    a.artist_name AS "artistName",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(AVG(f.completion_rate)::numeric, 3) AS "averageCompletionRate",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_artist a ON f.artist_key = a.artist_key
                WHERE f.completion_rate IS NOT NULL
                GROUP BY a.artist_name
                HAVING COUNT(f.fact_id) >= 3
                ORDER BY "averageCompletionRate" DESC
                LIMIT 10
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getPlatformStats() {
        String sql = """
                SELECT
                    p.platform_name AS "platformName",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_platform p ON f.platform_key = p.platform_key
                GROUP BY p.platform_name
                ORDER BY "totalMinutes" DESC
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getListeningHeatmap() {
        String sql = """
                SELECT
                    d.day_of_week AS "dayOfWeek",
                    d.day_name AS "dayName",
                    t.hour AS "hour",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_date d ON f.date_key = d.date_key
                JOIN dw_dim_time t ON f.time_key = t.time_key
                GROUP BY d.day_of_week, d.day_name, t.hour
                ORDER BY d.day_of_week, t.hour
                """;

        return jdbcTemplate.queryForList(sql);
    }

    public Map<String, Object> getPeakListeningTime() {
        String sql = """
                SELECT
                    d.day_of_week AS "dayOfWeek",
                    d.day_name AS "dayName",
                    t.hour AS "hour",
                    COUNT(f.fact_id) AS "totalPlays",
                    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS "totalMinutes"
                FROM dw_fact_listening_event f
                JOIN dw_dim_date d ON f.date_key = d.date_key
                JOIN dw_dim_time t ON f.time_key = t.time_key
                GROUP BY d.day_of_week, d.day_name, t.hour
                ORDER BY "totalPlays" DESC, "totalMinutes" DESC
                LIMIT 1
                """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

        if (rows.isEmpty()) {
            Map<String, Object> emptyResult = new LinkedHashMap<>();
            emptyResult.put("message", "No listening data available yet.");
            emptyResult.put("dayOfWeek", null);
            emptyResult.put("dayName", null);
            emptyResult.put("hour", null);
            emptyResult.put("totalPlays", 0);
            emptyResult.put("totalMinutes", 0.0);
            return emptyResult;
        }

        Map<String, Object> peak = new LinkedHashMap<>(rows.get(0));

        Object dayName = peak.get("dayName");
        Object hour = peak.get("hour");

        peak.put("message", "Your peak listening time is " + dayName + " at " + hour + ":00.");

        return peak;
    }

    public Map<String, Object> getListeningPersonality() {
        Map<String, Object> result = new LinkedHashMap<>();

        List<Map<String, Object>> partOfDayStats = getPartOfDayStats();
        List<Map<String, Object>> dayTypeStats = getWeekendVsWeekdayStats();

        if (partOfDayStats.isEmpty()) {
            result.put("personality", "No Data Yet");
            result.put("description", "Import and process listening data before generating a listening personality.");
            result.put("dominantPartOfDay", null);
            result.put("dominantDayType", null);
            return result;
        }

        String dominantPartOfDay = String.valueOf(partOfDayStats.get(0).get("partOfDay"));
        String dominantDayType = dayTypeStats.isEmpty()
                ? "unknown"
                : String.valueOf(dayTypeStats.get(0).get("dayType"));

        String personality = resolvePersonality(dominantPartOfDay, dominantDayType);
        String description = buildPersonalityDescription(dominantPartOfDay, dominantDayType);

        result.put("personality", personality);
        result.put("description", description);
        result.put("dominantPartOfDay", dominantPartOfDay);
        result.put("dominantDayType", dominantDayType);
        result.put("partOfDayStats", partOfDayStats);
        result.put("dayTypeStats", dayTypeStats);

        return result;
    }

    private String resolvePersonality(String dominantPartOfDay, String dominantDayType) {
        if ("night".equalsIgnoreCase(dominantPartOfDay)) {
            return "Night Listener";
        }

        if ("evening".equalsIgnoreCase(dominantPartOfDay)) {
            return "Evening Listener";
        }

        if ("morning".equalsIgnoreCase(dominantPartOfDay)) {
            return "Morning Starter";
        }

        if ("afternoon".equalsIgnoreCase(dominantPartOfDay)) {
            return "Afternoon Listener";
        }

        if ("weekend".equalsIgnoreCase(dominantDayType)) {
            return "Weekend Listener";
        }

        return "Everyday Listener";
    }

    private String buildPersonalityDescription(String dominantPartOfDay, String dominantDayType) {
        return "Most of your listening activity happens during the "
                + dominantPartOfDay
                + ", especially on "
                + dominantDayType
                + " days.";
    }
}