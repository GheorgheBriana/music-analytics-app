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

    private String factUserJoin(Long userId) {
        return userId != null ? " JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? " : "";
    }

    private String mvUserWhere(Long userId) {
        return userId != null ? " WHERE original_user_id = ? " : "";
    }

    private Object[] params(Long userId) {
        return userId != null ? new Object[]{userId} : new Object[]{};
    }

    public Map<String, Object> getWarehouseSummary(Long userId) {
        Map<String, Object> summary = new LinkedHashMap<>();
        String join = factUserJoin(userId);

        Long totalEvents = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dw.dw_fact_listening_event f " + join,
                Long.class, params(userId)
        );

        Double totalMinutes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(minutes_played), 0) FROM dw.dw_fact_listening_event f " + join,
                Double.class, params(userId)
        );

        Long uniqueTracks = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT track_key) FROM dw.dw_fact_listening_event f " + join,
                Long.class, params(userId)
        );

        Long uniqueArtists = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT artist_key) FROM dw.dw_fact_listening_event f " + join,
                Long.class, params(userId)
        );

        Long uniqueGenres = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT genre_key) FROM dw.dw_fact_listening_event f " + join,
                Long.class, params(userId)
        );

        summary.put("totalEvents", totalEvents);
        summary.put("totalMinutes", totalMinutes);
        summary.put("uniqueTracks", uniqueTracks);
        summary.put("uniqueArtists", uniqueArtists);
        summary.put("uniqueGenres", uniqueGenres);

        return summary;
    }

    public List<Map<String, Object>> getMonthlyListening(Long userId) {
        String sql = "SELECT year AS \"year\", month AS \"month\", month_name AS \"monthName\", " +
                     "total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_monthly_listening " + mvUserWhere(userId) +
                     " ORDER BY year, month";
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getPartOfDayStats(Long userId) {
        String sql = "SELECT part_of_day AS \"partOfDay\", total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_part_of_day_stats " + mvUserWhere(userId);
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getWeekendVsWeekdayStats(Long userId) {
        String sql = "SELECT day_type AS \"dayType\", total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_weekend_vs_weekday_stats " + mvUserWhere(userId);
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getTopGenres(Long userId) {
        String sql = "SELECT genre_name AS \"genreName\", total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_top_genres " + mvUserWhere(userId) +
                     " ORDER BY total_minutes DESC LIMIT 10";
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getCompletionRateByArtist(Long userId) {
        String sql = "SELECT a.artist_name AS \"artistName\", COUNT(f.fact_id) AS \"totalPlays\", " +
                     "ROUND((AVG(f.completion_rate) * 100)::numeric, 2) AS \"averageCompletionRate\", " +
                     "ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                     "FROM dw.dw_fact_listening_event f " +
                     "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                     (userId != null ? "JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? AND " : "WHERE ") +
                     "f.completion_rate IS NOT NULL " +
                     "GROUP BY a.artist_name HAVING COUNT(f.fact_id) >= 1 " +
                     "ORDER BY \"totalPlays\" DESC LIMIT 10";
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getPlatformStats(Long userId) {
        String join = factUserJoin(userId);
        String sql = "SELECT " +
                     "  CASE " +
                     "    WHEN LOWER(p.platform_name) LIKE '%windows%' THEN 'Windows' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%android%' THEN 'Android' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%ios%' OR LOWER(p.platform_name) LIKE '%iphone%' OR LOWER(p.platform_name) LIKE '%ipad%' THEN 'iOS' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%mac%' OR LOWER(p.platform_name) LIKE '%osx%' THEN 'macOS' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%linux%' THEN 'Linux' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%playstation%' OR LOWER(p.platform_name) LIKE '%ps4%' OR LOWER(p.platform_name) LIKE '%ps5%' OR LOWER(p.platform_name) LIKE '%scei%' THEN 'PlayStation' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%xbox%' THEN 'Xbox' " +
                     "    WHEN LOWER(p.platform_name) LIKE '%web_player%' OR LOWER(p.platform_name) LIKE '%web player%' THEN 'Web Player' " +
                     "    ELSE 'Other' " +
                     "  END AS \"platformName\", " +
                     "  COUNT(f.fact_id) AS \"totalPlays\", " +
                     "  ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                     "FROM dw.dw_fact_listening_event f " +
                     "JOIN dw.dw_dim_platform p ON f.platform_key = p.platform_key " +
                     join +
                     "GROUP BY 1 " +
                     "ORDER BY \"totalMinutes\" DESC";
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public List<Map<String, Object>> getListeningHeatmap(Long userId) {
        String sql = "SELECT day_of_week AS \"dayOfWeek\", day_name AS \"dayName\", hour AS \"hour\", " +
                     "total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_listening_heatmap " + mvUserWhere(userId) +
                     " ORDER BY day_of_week, hour";
        return jdbcTemplate.queryForList(sql, params(userId));
    }

    public Map<String, Object> getPeakListeningTime(Long userId) {
        String sql = "SELECT day_of_week AS \"dayOfWeek\", day_name AS \"dayName\", hour AS \"hour\", " +
                     "total_plays AS \"totalPlays\", total_minutes AS \"totalMinutes\" " +
                     "FROM dw.mv_listening_heatmap " + mvUserWhere(userId) +
                     " ORDER BY total_plays DESC, total_minutes DESC LIMIT 1";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params(userId));

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

    public Map<String, Object> getListeningPersonality(Long userId) {
        Map<String, Object> result = new LinkedHashMap<>();

        List<Map<String, Object>> partOfDayStats = getPartOfDayStats(userId);
        List<Map<String, Object>> dayTypeStats = getWeekendVsWeekdayStats(userId);

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
        if ("night".equalsIgnoreCase(dominantPartOfDay)) return "Night Listener";
        if ("evening".equalsIgnoreCase(dominantPartOfDay)) return "Evening Listener";
        if ("morning".equalsIgnoreCase(dominantPartOfDay)) return "Morning Starter";
        if ("afternoon".equalsIgnoreCase(dominantPartOfDay)) return "Afternoon Listener";
        if ("weekend".equalsIgnoreCase(dominantDayType)) return "Weekend Listener";
        return "Everyday Listener";
    }

    private String buildPersonalityDescription(String dominantPartOfDay, String dominantDayType) {
        return "Most of your listening activity happens during the " + dominantPartOfDay + ", especially on " + dominantDayType + " days.";
    }

    public void refreshMaterializedViews() {
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_monthly_listening");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_part_of_day_stats");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_weekend_vs_weekday_stats");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_top_genres");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_listening_heatmap");
    }
}
