package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ComparisonDTO;
import com.alltimewrapped.backend.dto.DimensionScoreDTO;
import com.alltimewrapped.backend.dto.UserDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SocialService {

    private final AppUserRepository appUserRepository;
    private final JdbcTemplate jdbcTemplate;
    private final FriendshipService friendshipService;
    private final SystemSettingsService systemSettingsService;

    private static final int MIN_ABSOLUTE_PLAYS = 5;

    @Transactional(readOnly = true)
    public List<UserDTO> getAllUsers() {
        return appUserRepository.findAll().stream()
                .map(user -> new UserDTO(user.getId(), user.getUsername()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ComparisonDTO compareUsers(Long userId1, Long userId2) {
        if (systemSettingsService.isFriendingEnabled() 
            && !friendshipService.areFriends(userId1, userId2)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, 
                "You can only compare with your friends");
        }

        AppUser user1 = appUserRepository.findById(userId1)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 1 not found"));
        AppUser user2 = appUserRepository.findById(userId2)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 2 not found"));

        // 1. Fetch ALL Artists (Names & Play Counts) to construct complete vectors
        String artistSql = """
                SELECT a.artist_name, COUNT(f.fact_id) AS play_count
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY a.artist_name
                ORDER BY play_count DESC
                """;

        List<Map<String, Object>> u1ArtistRows = jdbcTemplate.queryForList(artistSql, userId1);
        List<Map<String, Object>> u2ArtistRows = jdbcTemplate.queryForList(artistSql, userId2);

        Map<String, Double> artistMap1 = u1ArtistRows.stream()
                .filter(r -> r.get("artist_name") != null)
                .collect(Collectors.toMap(
                        r -> (String) r.get("artist_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        Map<String, Double> artistMap2 = u2ArtistRows.stream()
                .filter(r -> r.get("artist_name") != null)
                .collect(Collectors.toMap(
                        r -> (String) r.get("artist_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        DimensionScoreDTO artistScore = calculateDimensionScore(artistMap1, artistMap2);

        // Common Artists: filtered by significance and sorted by MIN plays
        List<String> commonArtists = findMeaningfulCommon(artistMap1, artistMap2, 0.001, 10); // 0.1% threshold

        // 2. Fetch ALL Tracks (Names & Play Counts) to construct complete vectors
        String trackSql = """
                SELECT CONCAT(t.track_name, ' - ', a.artist_name) AS track_full_name, COUNT(f.fact_id) AS play_count
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_track t ON f.track_key = t.track_key
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY t.track_name, a.artist_name
                ORDER BY play_count DESC
                """;

        List<Map<String, Object>> u1TrackRows = jdbcTemplate.queryForList(trackSql, userId1);
        List<Map<String, Object>> u2TrackRows = jdbcTemplate.queryForList(trackSql, userId2);

        Map<String, Double> trackMap1 = u1TrackRows.stream()
                .filter(r -> r.get("track_full_name") != null)
                .collect(Collectors.toMap(
                        r -> (String) r.get("track_full_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        Map<String, Double> trackMap2 = u2TrackRows.stream()
                .filter(r -> r.get("track_full_name") != null)
                .collect(Collectors.toMap(
                        r -> (String) r.get("track_full_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        DimensionScoreDTO trackScore = calculateDimensionScore(trackMap1, trackMap2);

        // Common Tracks: filtered by significance and sorted by MIN plays
        List<String> commonTracks = findMeaningfulCommon(trackMap1, trackMap2, 0.0001, 10); // 0.01% threshold

        // 3. Fetch Top Genres from Materialized Views (using pre-aggregated play count)
        String genreSql = """
                SELECT genre_name, SUM(total_plays) AS play_count
                FROM dw.mv_top_genres
                WHERE original_user_id = ?
                GROUP BY genre_name
                ORDER BY play_count DESC
                """;

        List<Map<String, Object>> u1GenreRows = jdbcTemplate.queryForList(genreSql, userId1);
        List<Map<String, Object>> u2GenreRows = jdbcTemplate.queryForList(genreSql, userId2);

        Map<String, Double> genreMap1 = u1GenreRows.stream()
                .filter(r -> r.get("genre_name") != null && !((String) r.get("genre_name")).trim().isEmpty())
                .collect(Collectors.toMap(
                        r -> (String) r.get("genre_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        Map<String, Double> genreMap2 = u2GenreRows.stream()
                .filter(r -> r.get("genre_name") != null && !((String) r.get("genre_name")).trim().isEmpty())
                .collect(Collectors.toMap(
                        r -> (String) r.get("genre_name"),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        DimensionScoreDTO genreScore = calculateDimensionScore(genreMap1, genreMap2);

        // Genre lists for Genre Compass
        Set<String> gSet1 = genreMap1.keySet();
        Set<String> gSet2 = genreMap2.keySet();

        // Common genres: intersection, sorted by total plays descending, top 15
        List<String> commonGenres = gSet1.stream()
                .filter(gSet2::contains)
                .sorted((g1, g2) -> Double.compare(genreMap1.get(g2) + genreMap2.get(g2), genreMap1.get(g1) + genreMap2.get(g1)))
                .limit(15)
                .collect(Collectors.toList());

        // Only User 1 genres: in gSet1 but not gSet2, sorted by User 1 plays descending, top 15
        List<String> onlyUser1Genres = gSet1.stream()
                .filter(g -> !gSet2.contains(g))
                .sorted((g1, g2) -> Double.compare(genreMap1.get(g2), genreMap1.get(g1)))
                .limit(15)
                .collect(Collectors.toList());

        // Only User 2 genres: in gSet2 but not gSet1, sorted by User 2 plays descending, top 15
        List<String> onlyUser2Genres = gSet2.stream()
                .filter(g -> !gSet1.contains(g))
                .sorted((g1, g2) -> Double.compare(genreMap2.get(g2), genreMap2.get(g1)))
                .limit(15)
                .collect(Collectors.toList());

        // 4. Fetch Listening Rhythm / Hours from Materialized Views (construct 24-dimensional vectors)
        String rhythmSql = """
                SELECT hour, SUM(total_plays) AS play_count
                FROM dw.mv_listening_heatmap
                WHERE original_user_id = ?
                GROUP BY hour
                """;

        List<Map<String, Object>> u1RhythmRows = jdbcTemplate.queryForList(rhythmSql, userId1);
        List<Map<String, Object>> u2RhythmRows = jdbcTemplate.queryForList(rhythmSql, userId2);

        Map<String, Double> rhythmMap1 = u1RhythmRows.stream()
                .filter(r -> r.get("hour") != null)
                .collect(Collectors.toMap(
                        r -> String.valueOf(r.get("hour")),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        Map<String, Double> rhythmMap2 = u2RhythmRows.stream()
                .filter(r -> r.get("hour") != null)
                .collect(Collectors.toMap(
                        r -> String.valueOf(r.get("hour")),
                        r -> ((Number) r.get("play_count")).doubleValue(),
                        (v1, v2) -> v1 + v2
                ));

        DimensionScoreDTO rhythmScore = calculateDimensionScore(rhythmMap1, rhythmMap2);

        // Final score: Weighted average of the 4 dimensions' final percents
        // 40% Artists + 30% Tracks + 20% Genres + 10% Rhythm
        int finalScore = (int) Math.round(
                (artistScore.getFinalPercent() * 0.40) +
                (trackScore.getFinalPercent() * 0.30) +
                (genreScore.getFinalPercent() * 0.20) +
                (rhythmScore.getFinalPercent() * 0.10)
        );

        // 5. Collaborative Filtering Recommendations: Tracks User 2 (Friend) has listened to that User 1 (Me) hasn't
        String recommendationsSql = """
                WITH user1_tracks AS (
                    SELECT DISTINCT t2.track_name
                    FROM dw.dw_fact_listening_event f2
                    JOIN dw.dw_dim_track t2 ON f2.track_key = t2.track_key
                    JOIN dw.dw_dim_user u2 ON f2.user_key = u2.user_key
                    WHERE u2.original_user_id = ?
                )
                SELECT t.track_name, a.artist_name, COUNT(*) AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_track t ON f.track_key = t.track_key
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                  AND t.track_name NOT IN (SELECT track_name FROM user1_tracks)
                GROUP BY t.track_name, a.artist_name
                ORDER BY plays DESC
                LIMIT 5
                """;

        List<Map<String, Object>> recRows = jdbcTemplate.queryForList(recommendationsSql, userId1, userId2);
        List<String> recommendations = new ArrayList<>();
        for (Map<String, Object> row : recRows) {
            recommendations.add(row.get("track_name") + " - " + row.get("artist_name"));
        }

        return ComparisonDTO.builder()
                .user1Name(user1.getUsername())
                .user2Name(user2.getUsername())
                .similarityScore(finalScore)
                .artistScore(artistScore)
                .trackScore(trackScore)
                .genreScore(genreScore)
                .rhythmScore(rhythmScore)
                .commonArtists(commonArtists)
                .commonTracks(commonTracks)
                .recommendations(recommendations)
                .commonGenres(commonGenres)
                .onlyUser1Genres(onlyUser1Genres)
                .onlyUser2Genres(onlyUser2Genres)
                .build();
    }

    private DimensionScoreDTO calculateDimensionScore(Map<String, Double> map1, Map<String, Double> map2) {
        Set<String> set1 = map1.keySet();
        Set<String> set2 = map2.keySet();

        // 1. Jaccard Similarity (Binary Set Overlap)
        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);
        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);

        double jaccard = union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();

        // 2. Cosine Similarity (Intensity-weighted play counts)
        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (String key : union) {
            double v1 = map1.getOrDefault(key, 0.0);
            double v2 = map2.getOrDefault(key, 0.0);
            dotProduct += v1 * v2;
            norm1 += v1 * v1;
            norm2 += v2 * v2;
        }

        double cosine = (norm1 == 0.0 || norm2 == 0.0) ? 0.0 : dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

        // 3. Hybrid Final Score (Average of Jaccard and Cosine converted to 0-100)
        int finalPercent = (int) Math.round(((jaccard + cosine) / 2.0) * 100);

        return new DimensionScoreDTO(jaccard, cosine, finalPercent);
    }

    private List<String> findMeaningfulCommon(
            Map<String, Double> map1, 
            Map<String, Double> map2, 
            double thresholdPercent,
            int limit) {
        
        double total1 = map1.values().stream().mapToDouble(Double::doubleValue).sum();
        double total2 = map2.values().stream().mapToDouble(Double::doubleValue).sum();
        
        if (total1 == 0 || total2 == 0) return List.of();
        
        return map1.entrySet().stream()
            .filter(e -> map2.containsKey(e.getKey()))
            .filter(e -> {
                double v1 = e.getValue();
                double v2 = map2.get(e.getKey());
                // Both must have at least MIN_ABSOLUTE_PLAYS
                if (v1 < MIN_ABSOLUTE_PLAYS || v2 < MIN_ABSOLUTE_PLAYS) return false;
                // Both must dedicate at least thresholdPercent of their library
                double pct1 = v1 / total1;
                double pct2 = v2 / total2;
                return pct1 >= thresholdPercent && pct2 >= thresholdPercent;
            })
            // Sort by MIN plays descending to prioritize mutual high interest
            .sorted((a, b) -> Double.compare(
                Math.min(map2.get(b.getKey()), b.getValue()),
                Math.min(map2.get(a.getKey()), a.getValue())))
            .limit(limit)
            .map(e -> {
                int plays1 = e.getValue().intValue();
                int plays2 = map2.get(e.getKey()).intValue();
                return e.getKey() + " (you: " + plays1 + " · them: " + plays2 + ")";
            })
            .collect(Collectors.toList());
    }
}
