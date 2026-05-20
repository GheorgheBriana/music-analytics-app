package com.alltimewrapped.backend.analytics.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MusicInsightService {

    private final JdbcTemplate jdbcTemplate;

    private String factUserWhere(Long userId) {
        return userId != null ? " JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? " : "";
    }

    private Object[] params(Long userId) {
        return userId != null ? new Object[]{userId} : new Object[]{};
    }

    public Map<String, Object> getMusicInsights(Long userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        String joinWhere = factUserWhere(userId);

        long totalPlays = getLongValue(
                "SELECT COUNT(*) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        if (totalPlays == 0) {
            result.put("message", "No analytics data available yet.");
            result.put("profileTitle", "No Data Yet");
            result.put("description", "Import and process listening data before generating music insights.");
            result.put("insights", List.of());
            return result;
        }

        double totalMinutes = getDoubleValue(
                "SELECT COALESCE(SUM(minutes_played), 0) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        long uniqueTracks = getLongValue(
                "SELECT COUNT(DISTINCT track_key) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        long uniqueArtists = getLongValue(
                "SELECT COUNT(DISTINCT artist_key) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        long uniqueGenres = getLongValue(
                "SELECT COUNT(DISTINCT genre_key) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        double skipRate = getDoubleValue(
                "SELECT COALESCE(AVG(CASE WHEN skipped = true THEN 1.0 ELSE 0.0 END), 0) FROM dw.dw_fact_listening_event f " + joinWhere,
                userId
        );

        double averageCompletionRate = getDoubleValue(
                "SELECT COALESCE(AVG(completion_rate), 0) FROM dw.dw_fact_listening_event f " +
                (userId != null ? "JOIN dw.dw_dim_user u ON f.user_key = u.user_key WHERE u.original_user_id = ? AND " : "WHERE ") +
                "completion_rate IS NOT NULL",
                userId
        );

        Map<String, Object> topArtist = getFirstRow(
                "SELECT a.artist_name AS \"artistName\", COUNT(f.fact_id) AS \"totalPlays\", " +
                "ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key " +
                joinWhere +
                "GROUP BY a.artist_name ORDER BY \"totalPlays\" DESC, \"totalMinutes\" DESC LIMIT 1",
                userId
        );

        Map<String, Object> topTrack = getFirstRow(
                "SELECT t.track_name AS \"trackName\", COUNT(f.fact_id) AS \"totalPlays\", " +
                "ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_track t ON f.track_key = t.track_key " +
                joinWhere +
                "GROUP BY t.track_name ORDER BY \"totalPlays\" DESC, \"totalMinutes\" DESC LIMIT 1",
                userId
        );

        Map<String, Object> topGenre = getFirstRow(
                "SELECT g.genre_name AS \"genreName\", COUNT(f.fact_id) AS \"totalPlays\", " +
                "ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key " +
                joinWhere +
                "GROUP BY g.genre_name ORDER BY \"totalPlays\" DESC, \"totalMinutes\" DESC LIMIT 1",
                userId
        );

        Map<String, Object> dominantPartOfDay = getFirstRow(
                "SELECT t.part_of_day AS \"partOfDay\", COUNT(f.fact_id) AS \"totalPlays\", " +
                "ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS \"totalMinutes\" " +
                "FROM dw.dw_fact_listening_event f " +
                "JOIN dw.dw_dim_time t ON f.time_key = t.time_key " +
                joinWhere +
                "GROUP BY t.part_of_day ORDER BY \"totalPlays\" DESC, \"totalMinutes\" DESC LIMIT 1",
                userId
        );

        double diversityScore = calculateDiversityScore(uniqueTracks, totalPlays);
        double repeatScore = calculateRepeatScore(diversityScore);

        String profileTitle = resolveProfileTitle(dominantPartOfDay, diversityScore, repeatScore);
        String description = buildProfileDescription(profileTitle, dominantPartOfDay, topGenre);
        List<String> insights = buildInsightMessages(
                totalPlays, totalMinutes, uniqueTracks, uniqueArtists, uniqueGenres,
                diversityScore, repeatScore, skipRate, averageCompletionRate,
                topArtist, topTrack, topGenre, dominantPartOfDay
        );

        result.put("profileTitle", profileTitle);
        result.put("description", description);
        result.put("totalPlays", totalPlays);
        result.put("totalMinutes", round(totalMinutes));
        result.put("uniqueTracks", uniqueTracks);
        result.put("uniqueArtists", uniqueArtists);
        result.put("uniqueGenres", uniqueGenres);
        result.put("diversityScore", round(diversityScore));
        result.put("repeatScore", round(repeatScore));
        result.put("skipRate", round(skipRate));
        result.put("averageCompletionRate", round(averageCompletionRate));
        result.put("topArtist", topArtist);
        result.put("topTrack", topTrack);
        result.put("topGenre", topGenre);
        result.put("dominantPartOfDay", dominantPartOfDay);
        result.put("insights", insights);

        return result;
    }

    private long getLongValue(String sql, Long userId) {
        Number value = jdbcTemplate.queryForObject(sql, Number.class, params(userId));
        return value != null ? value.longValue() : 0L;
    }

    private double getDoubleValue(String sql, Long userId) {
        Number value = jdbcTemplate.queryForObject(sql, Number.class, params(userId));
        return value != null ? value.doubleValue() : 0.0;
    }

    private Map<String, Object> getFirstRow(String sql, Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params(userId));
        return rows.isEmpty() ? new LinkedHashMap<>() : new LinkedHashMap<>(rows.get(0));
    }

    private double calculateDiversityScore(long uniqueTracks, long totalPlays) {
        return totalPlays == 0 ? 0.0 : uniqueTracks / (double) totalPlays;
    }

    private double calculateRepeatScore(double diversityScore) {
        return Math.max(0.0, 1.0 - diversityScore);
    }

    private String resolveProfileTitle(Map<String, Object> dominantPartOfDay, double diversityScore, double repeatScore) {
        String partOfDay = String.valueOf(dominantPartOfDay.getOrDefault("partOfDay", "unknown"));
        if ("night".equalsIgnoreCase(partOfDay)) return "Night Listener";
        if ("evening".equalsIgnoreCase(partOfDay)) return "Evening Listener";
        if ("morning".equalsIgnoreCase(partOfDay)) return "Morning Starter";
        if (diversityScore >= 0.70) return "Music Explorer";
        if (repeatScore >= 0.60) return "Repeat Lover";
        return "Balanced Listener";
    }

    private String buildProfileDescription(String profileTitle, Map<String, Object> dominantPartOfDay, Map<String, Object> topGenre) {
        String partOfDay = String.valueOf(dominantPartOfDay.getOrDefault("partOfDay", "unknown"));
        String genreName = String.valueOf(topGenre.getOrDefault("genreName", "unknown"));
        return switch (profileTitle) {
            case "Night Listener" -> "Most of your listening activity happens at night, with a strong preference for " + genreName + ".";
            case "Evening Listener" -> "You usually listen to music in the evening, and your most visible genre is " + genreName + ".";
            case "Morning Starter" -> "Music seems to be part of how you start your day, especially around the " + partOfDay + ".";
            case "Music Explorer" -> "Your listening history shows a diverse taste, with many different tracks and artists.";
            case "Repeat Lover" -> "You tend to return to songs you like, which means your listening behavior has a strong replay pattern.";
            default -> "Your listening behavior is balanced, with a mix of familiar songs and music discovery.";
        };
    }

    private List<String> buildInsightMessages(
            long totalPlays, double totalMinutes, long uniqueTracks, long uniqueArtists, long uniqueGenres,
            double diversityScore, double repeatScore, double skipRate, double averageCompletionRate,
            Map<String, Object> topArtist, Map<String, Object> topTrack, Map<String, Object> topGenre,
            Map<String, Object> dominantPartOfDay
    ) {
        List<String> insights = new ArrayList<>();
        insights.add("You have " + totalPlays + " listening events, with about " + round(totalMinutes) + " total minutes played.");
        insights.add("Your library includes " + uniqueTracks + " unique tracks, " + uniqueArtists + " unique artists and " + uniqueGenres + " unique genres.");
        if (!topArtist.isEmpty()) insights.add("Your most played artist is " + topArtist.get("artistName") + ".");
        if (!topTrack.isEmpty()) insights.add("Your most repeated track is " + topTrack.get("trackName") + ".");
        if (!topGenre.isEmpty()) insights.add("Your dominant genre is " + topGenre.get("genreName") + ".");
        if (!dominantPartOfDay.isEmpty()) insights.add("You listen most often during the " + dominantPartOfDay.get("partOfDay") + ".");
        if (diversityScore >= 0.70) insights.add("Your diversity score is high, so your listening behavior suggests exploration.");
        else if (repeatScore >= 0.60) insights.add("Your repeat score is high, so you often return to familiar songs.");
        else insights.add("Your diversity and repeat patterns are balanced.");
        if (skipRate >= 0.40) insights.add("Your skip rate is relatively high, which may suggest that you browse quickly through tracks.");
        else insights.add("Your skip rate is low to moderate, which suggests that you usually let songs play.");
        if (averageCompletionRate >= 0.75) insights.add("Your average completion rate is high, meaning you often listen to songs almost until the end.");
        return insights;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
