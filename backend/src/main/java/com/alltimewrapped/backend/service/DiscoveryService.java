package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiscoveryService {

    private final JdbcTemplate jdbcTemplate;
    private final TasteEvolutionService tasteEvolutionService;
    private final LastFmService lastFmService;

    @Transactional(readOnly = true)
    public DiscoveryResponse getRecommendations(Long userId, String level) {
        log.info("[DISCOVERY] Calculating recommendations for user ID {}, level {}", userId, level);

        String activeLevel = (level != null) ? level.toLowerCase().trim() : "comfort";

        // 1. Fetch target user's genre stats
        List<Map<String, Object>> genreRows = jdbcTemplate.queryForList("""
                SELECT genre_name, total_plays
                FROM dw.mv_top_genres
                WHERE original_user_id = ?
                ORDER BY total_plays DESC
                """, userId);

        if (genreRows.isEmpty()) {
            return new DiscoveryResponse(List.of(), "We do not have enough data to create personalized recommendations. Please import more listening history.");
        }

        // List of user genres sorted descending
        List<String> sortedGenres = genreRows.stream()
                .map(r -> (String) r.get("genre_name"))
                .toList();

        // 2. Fetch the set of artists the user already listened to (to avoid recommending them)
        List<String> listenedArtistsRows = jdbcTemplate.queryForList("""
                SELECT DISTINCT a.artist_name
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                WHERE u.original_user_id = ?
                """, String.class, userId);
        Set<String> listenedArtists = new HashSet<>();
        for (String artist : listenedArtistsRows) {
            if (artist != null) listenedArtists.add(artist.toLowerCase().trim());
        }

        List<DiscoveryRecommendation> recommendations = new ArrayList<>();
        String fallbackMessage = null;

        // Try Collaborative Filtering
        try {
            recommendations = runCollaborativeFiltering(userId, activeLevel, sortedGenres, listenedArtists);
        } catch (Exception e) {
            log.error("[DISCOVERY] Collaborative Filtering failed, will rely on local content-based fallback", e);
        }

        // 3. Fallback: If CF yielded less than 5 recommendations, fill with local content-based fallback (slope trajectory)
        if (recommendations.size() < 5) {
            log.info("[DISCOVERY] Collaborative Filtering yielded only {} items. Running content-based trajectory fallback.", recommendations.size());
            List<DiscoveryRecommendation> fallbackItems = runContentBasedFallback(userId, activeLevel, sortedGenres, listenedArtists, recommendations);
            recommendations.addAll(fallbackItems);
            
            if (recommendations.isEmpty()) {
                fallbackMessage = "Your tastes are unique! We could not generate social collaborative recommendations, so we suggest exploring artists in your favorite genres.";
                // Last ditch effort: populate using top genres directly
                List<DiscoveryRecommendation> emergencyItems = runEmergencyFallback(activeLevel, sortedGenres, listenedArtists, recommendations);
                recommendations.addAll(emergencyItems);
            } else {
                fallbackMessage = "Since you are among the first users in the community, recommendations are based on your personal taste trajectory from Evolution.";
            }
        }

        // Limit results to 5
        List<DiscoveryRecommendation> finalRecs = recommendations.stream()
                .distinct()
                .limit(5)
                .toList();

        return new DiscoveryResponse(finalRecs, fallbackMessage);
    }

    private List<DiscoveryRecommendation> runCollaborativeFiltering(
            Long userId, String level, List<String> targetGenres, Set<String> listenedArtists) {

        // Get target user genre vector
        Map<String, Double> targetVector = getUserGenreVector(userId);
        if (targetVector.isEmpty()) return List.of();

        // Get all other users' genre vectors
        List<Long> otherUserIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT original_user_id
                FROM dw.mv_top_genres
                WHERE original_user_id != ?
                """, Long.class, userId);

        List<Object[]> userSimilarities = new ArrayList<>();
        for (Long otherId : otherUserIds) {
            Map<String, Double> otherVector = getUserGenreVector(otherId);
            double similarity = cosineSimilarity(targetVector, otherVector);
            if (similarity >= 0.3) { // similarity threshold
                userSimilarities.add(new Object[]{otherId, similarity});
            }
        }

        // Sort by similarity descending
        userSimilarities.sort((o1, o2) -> Double.compare((double) o2[1], (double) o1[1]));

        List<DiscoveryRecommendation> recs = new ArrayList<>();

        for (Object[] simObj : userSimilarities) {
            Long peerId = (Long) simObj[0];
            double similarityScore = (double) simObj[1];

            // Fetch top artists of the peer
            List<Map<String, Object>> peerArtists = jdbcTemplate.queryForList("""
                    SELECT a.artist_name, g.genre_name, COUNT(f.fact_id) as plays
                    FROM dw.dw_fact_listening_event f
                    JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                    JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                    JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                    WHERE u.original_user_id = ?
                    GROUP BY a.artist_name, g.genre_name
                    ORDER BY plays DESC
                    LIMIT 15
                    """, peerId);

            for (Map<String, Object> r : peerArtists) {
                String artist = (String) r.get("artist_name");
                String genre = (String) r.get("genre_name");
                if (artist == null || genre == null) continue;

                // Skip if target already listened to this artist
                if (listenedArtists.contains(artist.toLowerCase().trim())) continue;

                // Match with level constraints
                boolean levelMatch = matchesLevel(level, genre, targetGenres);
                if (levelMatch) {
                    String simpleReason = "Recommended based on your social profile.";
                    String detailedReason = String.format(
                            "A user with similar tastes (%.0f%% genre match) listens heavily to this artist. Level: %s.",
                            similarityScore * 100, level
                    );
                    recs.add(new DiscoveryRecommendation(artist, genre, level, simpleReason, detailedReason));
                }
            }
            if (recs.size() >= 10) break; // enough recommendations to filter down
        }

        return recs;
    }

    private List<DiscoveryRecommendation> runContentBasedFallback(
            Long userId, String level, List<String> targetGenres, Set<String> listenedArtists, List<DiscoveryRecommendation> existing) {

        List<DiscoveryRecommendation> fallbackRecs = new ArrayList<>();
        Set<String> alreadyRecommended = new HashSet<>();
        for (DiscoveryRecommendation rec : existing) {
            alreadyRecommended.add(rec.artistName().toLowerCase().trim());
        }

        // Get projections from TasteEvolutionService
        List<GenreProjection> projections;
        try {
            projections = tasteEvolutionService.computeProjection(userId);
        } catch (Exception e) {
            log.error("[DISCOVERY] Failed to get evolution projections", e);
            projections = List.of();
        }

        // Filter growing genres (slope > 0)
        List<GenreProjection> growingProjections = projections.stream()
                .filter(p -> p.slope() > 0)
                .toList();

        if (growingProjections.isEmpty()) {
            return List.of(); // nothing growing, emergency fallback will trigger
        }

        // Sort growing genres by slope descending
        for (GenreProjection gp : growingProjections) {
            String genre = gp.genreName();

            // Match level constraints
            if (!matchesLevel(level, genre, targetGenres)) continue;

            // Fetch top artists of this genre from local DB first, then Last.fm as secondary
            List<String> artists = new ArrayList<>(getLocalTopArtistsForGenre(genre));
            if (artists.size() < 5) {
                List<String> lfmArtists = lastFmService.getTopArtistsByTag(genre);
                for (String lfmArtist : lfmArtists) {
                    if (lfmArtist != null && !artists.contains(lfmArtist)) {
                        artists.add(lfmArtist);
                    }
                }
            }
            int count = 0;
            for (String artist : artists) {
                if (artist == null) continue;
                String cleaned = artist.toLowerCase().trim();

                if (!listenedArtists.contains(cleaned) && !alreadyRecommended.contains(cleaned)) {
                    String simpleReason = "Discovered through your taste evolution.";
                    String detailedReason = String.format(
                            "Belongs to the genre %s, which is growing in your recent history (slope m = %.3f). Level: %s.",
                            genre, gp.slope(), level
                    );
                    fallbackRecs.add(new DiscoveryRecommendation(artist, genre, level, simpleReason, detailedReason));
                    alreadyRecommended.add(cleaned);
                    count++;
                }
                if (count >= 2) break; // take up to 2 artists per growing genre
            }
        }

        return fallbackRecs;
    }

    private List<DiscoveryRecommendation> runEmergencyFallback(
            String level, List<String> targetGenres, Set<String> listenedArtists, List<DiscoveryRecommendation> existing) {

        List<DiscoveryRecommendation> emergencyRecs = new ArrayList<>();
        Set<String> alreadyRecommended = new HashSet<>();
        for (DiscoveryRecommendation rec : existing) {
            alreadyRecommended.add(rec.artistName().toLowerCase().trim());
        }

        // Determine which genres to target based on level
        List<String> target = new ArrayList<>();
        if ("comfort".equals(level)) {
            target = targetGenres.subList(0, Math.min(3, targetGenres.size()));
        } else if ("balance".equals(level)) {
            if (targetGenres.size() > 3) {
                target = targetGenres.subList(3, Math.min(6, targetGenres.size()));
            } else {
                target = targetGenres;
            }
        } else { // adventure
            if (targetGenres.size() > 6) {
                target = targetGenres.subList(6, targetGenres.size());
            } else {
                // fall back to default genres we don't listen to
                target = List.of("classical", "jazz", "electronic", "hip hop", "indie");
            }
        }

        for (String genre : target) {
            // Fetch top artists of this genre from local DB first, then Last.fm as secondary
            List<String> artists = new ArrayList<>(getLocalTopArtistsForGenre(genre));
            if (artists.size() < 5) {
                List<String> lfmArtists = lastFmService.getTopArtistsByTag(genre);
                for (String lfmArtist : lfmArtists) {
                    if (lfmArtist != null && !artists.contains(lfmArtist)) {
                        artists.add(lfmArtist);
                    }
                }
            }
            int count = 0;
            for (String artist : artists) {
                if (artist == null) continue;
                String cleaned = artist.toLowerCase().trim();

                if (!listenedArtists.contains(cleaned) && !alreadyRecommended.contains(cleaned)) {
                    String simpleReason = String.format("Recommendation based on the %s genre.", genre);
                    String detailedReason = String.format(
                            "We suggest this artist from the %s genre to explore your library. Level: %s.",
                            genre, level
                    );
                    emergencyRecs.add(new DiscoveryRecommendation(artist, genre, level, simpleReason, detailedReason));
                    alreadyRecommended.add(cleaned);
                    count++;
                }
                if (count >= 2) break;
            }
        }

        return emergencyRecs;
    }

    private boolean matchesLevel(String level, String genre, List<String> targetGenres) {
        int index = targetGenres.indexOf(genre);
        
        if ("comfort".equals(level)) {
            // Must be in top 3 genres
            return index >= 0 && index < 3;
        } else if ("balance".equals(level)) {
            // Must be in rank 4-6 genres
            return index >= 3 && index < 6;
        } else { // adventure
            // Must be rank > 6 OR not present in the user's list at all
            return index < 0 || index >= 6;
        }
    }

    private Map<String, Double> getUserGenreVector(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT genre_name, total_plays
                FROM dw.mv_top_genres
                WHERE original_user_id = ?
                """, userId);

        double total = rows.stream()
                .mapToDouble(r -> ((Number) r.get("total_plays")).doubleValue())
                .sum();

        Map<String, Double> vector = new HashMap<>();
        if (total > 0) {
            for (Map<String, Object> r : rows) {
                String name = (String) r.get("genre_name");
                double plays = ((Number) r.get("total_plays")).doubleValue();
                vector.put(name, plays / total);
            }
        }
        return vector;
    }

    private double cosineSimilarity(Map<String, Double> a, Map<String, Double> b) {
        double dot = 0.0;
        for (Map.Entry<String, Double> e : a.entrySet()) {
            Double bv = b.get(e.getKey());
            if (bv != null) {
                dot += e.getValue() * bv;
            }
        }
        double normA = Math.sqrt(a.values().stream().mapToDouble(v -> v * v).sum());
        double normB = Math.sqrt(b.values().stream().mapToDouble(v -> v * v).sum());

        if (normA == 0 || normB == 0) return 0.0;
        return dot / (normA * normB);
    }

    private List<String> getLocalTopArtistsForGenre(String genre) {
        try {
            return jdbcTemplate.queryForList("""
                    SELECT ar.artist_name
                    FROM dw.dw_fact_listening_event f
                    JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                    JOIN dw.dw_dim_artist ar ON f.artist_key = ar.artist_key
                    WHERE LOWER(g.genre_name) = LOWER(?)
                    GROUP BY ar.artist_name
                    ORDER BY COUNT(f.fact_id) DESC
                    LIMIT 30
                    """, String.class, genre);
        } catch (Exception e) {
            log.error("Failed to query local top artists for genre {}: {}", genre, e.getMessage());
            return new ArrayList<>();
        }
    }
}
