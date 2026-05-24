package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ComparisonDTO;
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

    @Transactional(readOnly = true)
    public List<UserDTO> getAllUsers() {
        return appUserRepository.findAll().stream()
                .map(user -> new UserDTO(user.getId(), user.getUsername()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ComparisonDTO compareUsers(Long userId1, Long userId2) {
        AppUser user1 = appUserRepository.findById(userId1)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 1 not found"));
        AppUser user2 = appUserRepository.findById(userId2)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 2 not found"));

        // 1. Fetch Top 100 Artists from DWH (Keys & Names)
        String artistSql = """
                SELECT a.artist_key, a.artist_name
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY a.artist_key, a.artist_name
                ORDER BY COUNT(f.fact_id) DESC LIMIT 100
                """;

        List<Map<String, Object>> u1ArtistRows = jdbcTemplate.queryForList(artistSql, userId1);
        List<Map<String, Object>> u2ArtistRows = jdbcTemplate.queryForList(artistSql, userId2);

        Set<Long> u1ArtistKeys = u1ArtistRows.stream().map(r -> ((Number) r.get("artist_key")).longValue()).collect(Collectors.toSet());
        Set<Long> u2ArtistKeys = u2ArtistRows.stream().map(r -> ((Number) r.get("artist_key")).longValue()).collect(Collectors.toSet());

        Set<Long> commonArtistKeys = new HashSet<>(u1ArtistKeys);
        commonArtistKeys.retainAll(u2ArtistKeys);

        Set<Long> unionArtistKeys = new HashSet<>(u1ArtistKeys);
        unionArtistKeys.addAll(u2ArtistKeys);

        double artistSimilarity = unionArtistKeys.isEmpty() ? 0 : (double) commonArtistKeys.size() / unionArtistKeys.size();

        // Map common artist names for visual display
        List<String> commonArtists = u1ArtistRows.stream()
                .filter(r -> commonArtistKeys.contains(((Number) r.get("artist_key")).longValue()))
                .map(r -> (String) r.get("artist_name"))
                .distinct()
                .limit(10)
                .collect(Collectors.toList());

        // 2. Fetch Top 100 Tracks from DWH (Keys & Names)
        String trackSql = """
                SELECT t.track_key, t.track_name
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_track t ON f.track_key = t.track_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY t.track_key, t.track_name
                ORDER BY COUNT(f.fact_id) DESC LIMIT 100
                """;

        List<Map<String, Object>> u1TrackRows = jdbcTemplate.queryForList(trackSql, userId1);
        List<Map<String, Object>> u2TrackRows = jdbcTemplate.queryForList(trackSql, userId2);

        Set<Long> u1TrackKeys = u1TrackRows.stream().map(r -> ((Number) r.get("track_key")).longValue()).collect(Collectors.toSet());
        Set<Long> u2TrackKeys = u2TrackRows.stream().map(r -> ((Number) r.get("track_key")).longValue()).collect(Collectors.toSet());

        Set<Long> commonTrackKeys = new HashSet<>(u1TrackKeys);
        commonTrackKeys.retainAll(u2TrackKeys);

        Set<Long> unionTrackKeys = new HashSet<>(u1TrackKeys);
        unionTrackKeys.addAll(u2TrackKeys);

        double trackSimilarity = unionTrackKeys.isEmpty() ? 0 : (double) commonTrackKeys.size() / unionTrackKeys.size();

        List<String> commonTracks = u1TrackRows.stream()
                .filter(r -> commonTrackKeys.contains(((Number) r.get("track_key")).longValue()))
                .map(r -> (String) r.get("track_name"))
                .distinct()
                .limit(10)
                .collect(Collectors.toList());

        // 3. Fetch Top 15 Genres from Materialized Views (Pre-aggregated)
        String genreSql = "SELECT genre_name FROM dw.mv_top_genres WHERE original_user_id = ? ORDER BY total_plays DESC LIMIT 15";
        List<String> u1Genres = jdbcTemplate.queryForList(genreSql, String.class, userId1);
        List<String> u2Genres = jdbcTemplate.queryForList(genreSql, String.class, userId2);

        Set<String> u1GenreSet = new HashSet<>(u1Genres);
        Set<String> u2GenreSet = new HashSet<>(u2Genres);

        Set<String> commonGenres = new HashSet<>(u1GenreSet);
        commonGenres.retainAll(u2GenreSet);

        Set<String> unionGenres = new HashSet<>(u1GenreSet);
        unionGenres.addAll(u2GenreSet);

        double genreSimilarity = unionGenres.isEmpty() ? 0 : (double) commonGenres.size() / unionGenres.size();

        // 4. Fetch Listening Rhythm / Hours from Materialized Views
        String rhythmSql = "SELECT hour FROM dw.mv_listening_heatmap WHERE original_user_id = ? GROUP BY hour HAVING SUM(total_plays) >= 3";
        List<Integer> u1Hours = jdbcTemplate.queryForList(rhythmSql, Integer.class, userId1);
        List<Integer> u2Hours = jdbcTemplate.queryForList(rhythmSql, Integer.class, userId2);

        Set<Integer> u1HourSet = new HashSet<>(u1Hours);
        Set<Integer> u2HourSet = new HashSet<>(u2Hours);

        Set<Integer> commonHours = new HashSet<>(u1HourSet);
        commonHours.retainAll(u2HourSet);

        Set<Integer> unionHours = new HashSet<>(u1HourSet);
        unionHours.addAll(u2HourSet);

        double rhythmSimilarity = unionHours.isEmpty() ? 0 : (double) commonHours.size() / unionHours.size();

        // Final score: Weighted average of the four dimensions
        // 35% artists + 25% tracks + 20% genres + 20% rhythm
        double finalSimilarity = (artistSimilarity * 0.35) + (trackSimilarity * 0.25) + (genreSimilarity * 0.20) + (rhythmSimilarity * 0.20);
        int finalScore = (int) Math.round(finalSimilarity * 100);

        // 5. Collaborative Filtering Recommendations: Tracks User 2 (Friend) has listened to that User 1 (Me) hasn't
        String recommendationsSql = """
                SELECT t.track_name, a.artist_name, COUNT(*) AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_track t ON f.track_key = t.track_key
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                  AND t.track_name NOT IN (
                      SELECT t2.track_name
                      FROM dw.dw_fact_listening_event f2
                      JOIN dw.dw_dim_track t2 ON f2.track_key = t2.track_key
                      JOIN dw.dw_dim_user u2 ON f2.user_key = u2.user_key
                      WHERE u2.original_user_id = ?
                  )
                GROUP BY t.track_name, a.artist_name
                ORDER BY plays DESC
                LIMIT 5
                """;

        List<Map<String, Object>> recRows = jdbcTemplate.queryForList(recommendationsSql, userId2, userId1);
        List<String> recommendations = new ArrayList<>();
        for (Map<String, Object> row : recRows) {
            recommendations.add(row.get("track_name") + " - " + row.get("artist_name"));
        }

        return new ComparisonDTO(
                user1.getUsername(),
                user2.getUsername(),
                finalScore,
                commonArtists,
                commonTracks,
                recommendations
        );
    }
}
