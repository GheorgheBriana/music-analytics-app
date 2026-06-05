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
public class TasteEvolutionService {

    private final JdbcTemplate jdbcTemplate;

    private static final int MIN_MONTHS = 4;
    private static final double TURNING_POINT_K = 1.5;
    private static final int TOP_GENRES_FOR_STREAM = 8;

    private static final String[] MONTH_NAMES = {
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    };

    @Transactional(readOnly = true)
    public EvolutionResponse getEvolution(Long userId) {
        log.info("[EVOLUTION] Running Taste Evolution analysis for user ID {}", userId);

        // Fetch monthly play counts per genre from DW
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT d.year                AS year,
                       d.month               AS month,
                       g.genre_name          AS genre,
                       COUNT(f.fact_id)       AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY d.year, d.month, g.genre_name
                ORDER BY d.year, d.month
                """, userId);

        if (rows.isEmpty()) {
            return new EvolutionResponse(false, "No listening data found in the warehouse.", 0, null, null, List.of(), List.of(), List.of(), List.of(), List.of());
        }

        // Build monthly taste vectors (normalized proportions of plays)
        LinkedHashMap<String, Map<String, Double>> monthlyVectors = buildMonthlyVectors(rows);

        if (monthlyVectors.size() < MIN_MONTHS) {
            return new EvolutionResponse(
                false,
                "Your music taste evolution analysis requires at least " + MIN_MONTHS + " months of history in the warehouse. " +
                "Currently you have " + monthlyVectors.size() + " months synchronized.",
                monthlyVectors.size(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
            );
        }

        List<String> months = new ArrayList<>(monthlyVectors.keySet());
        Set<String> allGenres = new TreeSet<>();
        for (Map<String, Double> v : monthlyVectors.values()) {
            allGenres.addAll(v.keySet());
        }

        // Compute volatility series (consecutive cosine distances)
        List<TasteShift> volatility = computeVolatility(months, monthlyVectors);

        // Statistic turning point detection (mean + 1.5 * sigma)
        markTurningPoints(volatility);
        List<TasteShift> turningPoints = volatility.stream()
                .filter(TasteShift::isTurningPoint)
                .toList();

        // Build stream segments, projections, and story cards
        List<GenreStream> streams = buildStreams(months, monthlyVectors, allGenres);
        List<GenreProjection> projections = computeProjection(userId);
        List<StoryCard> cards = buildStoryCards(userId, months, monthlyVectors, allGenres, volatility, turningPoints, projections);

        return new EvolutionResponse(
                true,
                "Taste evolution successfully calculated.",
                months.size(),
                months.get(0),
                months.get(months.size() - 1),
                streams,
                volatility,
                turningPoints,
                cards,
                projections
        );
    }

    private LinkedHashMap<String, Map<String, Double>> buildMonthlyVectors(List<Map<String, Object>> rows) {
        LinkedHashMap<String, Map<String, Double>> raw = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            int year = ((Number) r.get("year")).intValue();
            int month = ((Number) r.get("month")).intValue();
            String genre = (String) r.get("genre");
            double plays = ((Number) r.get("plays")).doubleValue();

            String key = year + "-" + String.format("%02d", month);
            raw.computeIfAbsent(key, k -> new HashMap<>())
               .merge(genre, plays, Double::sum);
        }

        LinkedHashMap<String, Map<String, Double>> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Double>> e : raw.entrySet()) {
            double total = e.getValue().values().stream().mapToDouble(Double::doubleValue).sum();
            Map<String, Double> vec = new HashMap<>();
            if (total > 0) {
                for (Map.Entry<String, Double> g : e.getValue().entrySet()) {
                    vec.put(g.getKey(), g.getValue() / total);
                }
            }
            normalized.put(e.getKey(), vec);
        }
        return normalized;
    }

    private List<TasteShift> computeVolatility(List<String> months, Map<String, Map<String, Double>> vectors) {
        List<TasteShift> shifts = new ArrayList<>();
        for (int i = 1; i < months.size(); i++) {
            Map<String, Double> prev = vectors.get(months.get(i - 1));
            Map<String, Double> curr = vectors.get(months.get(i));

            double cosine = cosineSimilarity(prev, curr);
            double distance = 1.0 - cosine;

            shifts.add(new TasteShift(
                    months.get(i - 1),
                    months.get(i),
                    i,
                    round(distance, 4),
                    false
            ));
        }
        return shifts;
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

    private void markTurningPoints(List<TasteShift> shifts) {
        if (shifts.isEmpty()) return;

        double mean = shifts.stream().mapToDouble(TasteShift::distance).average().orElse(0);
        double variance = shifts.stream()
                .mapToDouble(s -> Math.pow(s.distance() - mean, 2))
                .average().orElse(0);
        double sigma = Math.sqrt(variance);

        double threshold = mean + TURNING_POINT_K * sigma;

        for (int i = 0; i < shifts.size(); i++) {
            TasteShift s = shifts.get(i);
            boolean isTp = s.distance() > threshold && sigma > 0;
            if (isTp) {
                shifts.set(i, new TasteShift(s.fromMonth(), s.toMonth(), s.monthIndex(), s.distance(), true));
            }
        }
    }

    private List<GenreStream> buildStreams(List<String> months, Map<String, Map<String, Double>> vectors, Set<String> allGenres) {
        Map<String, Double> genreTotals = new HashMap<>();
        for (Map<String, Double> v : vectors.values()) {
            for (Map.Entry<String, Double> g : v.entrySet()) {
                genreTotals.merge(g.getKey(), g.getValue(), Double::sum);
            }
        }

        List<String> topGenres = genreTotals.entrySet().stream()
                .filter(entry -> !entry.getKey().equalsIgnoreCase("unknown"))
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(TOP_GENRES_FOR_STREAM)
                .map(Map.Entry::getKey)
                .toList();

        List<GenreStream> streams = new ArrayList<>();
        for (String genre : topGenres) {
            List<Double> series = new ArrayList<>();
            for (String m : months) {
                series.add(round(vectors.get(m).getOrDefault(genre, 0.0), 4));
            }
            streams.add(new GenreStream(genre, series));
        }

        List<Double> otherSeries = new ArrayList<>();
        for (String m : months) {
            double sumOther = 0.0;
            for (Map.Entry<String, Double> g : vectors.get(m).entrySet()) {
                if (!topGenres.contains(g.getKey())) sumOther += g.getValue();
            }
            otherSeries.add(round(sumOther, 4));
        }

        boolean hasOther = otherSeries.stream().anyMatch(v -> v > 0);
        if (hasOther) {
            streams.add(new GenreStream("Other", otherSeries));
        }

        return streams;
    }

    public List<GenreProjection> computeProjection(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT d.year             AS year,
                       d.month            AS month,
                       g.genre_name       AS genre,
                       COUNT(f.fact_id)    AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY d.year, d.month, g.genre_name
                ORDER BY g.genre_name, d.year, d.month
                """, userId);

        Map<String, List<double[]>> byGenre = new HashMap<>();
        for (Map<String, Object> r : rows) {
            String genre = (String) r.get("genre");
            double plays = ((Number) r.get("plays")).doubleValue();
            byGenre.computeIfAbsent(genre, k -> new ArrayList<>()).add(new double[]{0, plays});
        }

        List<GenreProjection> projections = new ArrayList<>();
        double lambda = 0.3; // Decay parameter for recency weighting

        for (Map.Entry<String, List<double[]>> e : byGenre.entrySet()) {
            List<double[]> series = e.getValue();
            int window = Math.min(6, series.size());
            if (window < 3) continue;

            List<double[]> last = series.subList(series.size() - window, series.size());
            int n = last.size();
            double[] x = new double[n];
            double[] y = new double[n];
            double[] w = new double[n];
            double sumW = 0;

            for (int i = 0; i < n; i++) {
                x[i] = i;
                y[i] = last.get(i)[1];
                w[i] = Math.exp(lambda * i); // Exponential decay weights
                sumW += w[i];
            }

            if (sumW == 0) continue;

            // Weighted means
            double meanXw = 0;
            double meanYw = 0;
            for (int i = 0; i < n; i++) {
                meanXw += w[i] * x[i];
                meanYw += w[i] * y[i];
            }
            meanXw /= sumW;
            meanYw /= sumW;

            // Weighted Least Squares calculations
            double num = 0;
            double den = 0;
            for (int i = 0; i < n; i++) {
                double diffX = x[i] - meanXw;
                num += w[i] * diffX * (y[i] - meanYw);
                den += w[i] * diffX * diffX;
            }

            if (den == 0) continue;

            double slope = num / den;
            double intercept = meanYw - slope * meanXw;

            // Weighted R-Squared (coefficient of determination)
            double ssRes = 0;
            double ssTot = 0;
            for (int i = 0; i < n; i++) {
                double yHat = slope * x[i] + intercept;
                ssRes += w[i] * Math.pow(y[i] - yHat, 2);
                ssTot += w[i] * Math.pow(y[i] - meanYw, 2);
            }

            double rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

            projections.add(new GenreProjection(
                    e.getKey(),
                    round(slope, 3),
                    round(rSquared, 3),
                    confidenceLabel(rSquared)
            ));
        }

        return projections.stream()
                .filter(p -> p.slope() > 0)
                .sorted(Comparator.comparingDouble(GenreProjection::slope).reversed())
                .toList();
    }

    private List<StoryCard> buildStoryCards(
            Long userId,
            List<String> months,
            Map<String, Map<String, Double>> vectors,
            Set<String> allGenres,
            List<TasteShift> volatility,
            List<TasteShift> turningPoints,
            List<GenreProjection> projections) {

        List<StoryCard> cards = new ArrayList<>();

        List<Map<String, Object>> yearRows = jdbcTemplate.queryForList("""
                SELECT d.year          AS year,
                       g.genre_name    AS genre,
                       COUNT(f.fact_id) AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY d.year, g.genre_name
                ORDER BY d.year
                """, userId);

        Map<Integer, Map<String, Double>> byYear = new TreeMap<>();
        for (Map<String, Object> r : yearRows) {
            int year = ((Number) r.get("year")).intValue();
            String genre = (String) r.get("genre");
            double plays = ((Number) r.get("plays")).doubleValue();
            byYear.computeIfAbsent(year, k -> new HashMap<>()).merge(genre, plays, Double::sum);
        }

        // 1. Most diverse year
        byYear.entrySet().stream()
                .max(Comparator.comparingInt(e -> e.getValue().size()))
                .ifPresent(e -> cards.add(new StoryCard(
                        "MOST_DIVERSE_YEAR",
                        "Most Diverse Year",
                        String.valueOf(e.getKey()),
                        "You listened to " + e.getValue().size() + " different genres in " + e.getKey() + "."
                )));

        // 2. Most loyal year
        byYear.entrySet().stream()
                .map(e -> {
                    double total = e.getValue().values().stream().mapToDouble(Double::doubleValue).sum();
                    String topGenre = e.getValue().entrySet().stream()
                            .filter(entry -> !entry.getKey().equalsIgnoreCase("unknown"))
                            .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("?");
                    double topShare = total > 0 ? e.getValue().getOrDefault(topGenre, 0.0) / total : 0;
                    return new Object[]{e.getKey(), topGenre, topShare};
                })
                .max(Comparator.comparingDouble(o -> (double) o[2]))
                .ifPresent(o -> cards.add(new StoryCard(
                        "MOST_LOYAL_YEAR",
                        "Most Loyal Year",
                        String.valueOf(o[0]),
                        String.format("In %s, %.0f%% of your streams were a single genre (%s).", o[0], (double) o[2] * 100, o[1])
                )));

        // 3. Anchor genre
        addAnchorGenreCard(cards, months, vectors, allGenres);

        // 4. Meteor genre
        addMeteorGenreCard(cards, months, vectors, allGenres);

        // 5. Turning point
        turningPoints.stream()
                .max(Comparator.comparingDouble(TasteShift::distance))
                .ifPresent(tp -> {
                    String dominantNew = dominantGenre(vectors.get(tp.toMonth()));
                    cards.add(new StoryCard(
                            "TURNING_POINT",
                            "Turning Point",
                            humanMonth(tp.toMonth()),
                            "In " + humanMonth(tp.toMonth()) + " your taste shifted strongly" + (dominantNew != null ? " towards " + dominantNew : "") + "."
                    ));
                });

        // 6 & 7. Stability cards
        addStabilityCards(cards, volatility);

        // 8. Future Direction
        if (!projections.isEmpty()) {
            GenreProjection top = projections.get(0);
            String certainty = switch (top.confidenceLabel()) {
                case "HIGH" -> "The trend is clear";
                case "MEDIUM" -> "The trend is moderate";
                default -> "The trend is uncertain, but";
            };
            cards.add(new StoryCard(
                    "FUTURE_DIRECTION",
                    "Future Direction",
                    top.genreName(),
                    certainty + ": in recent months you are listening more and more to " + top.genreName() + "."
            ));
        }

        // 9. Nocturnal genre
        addNocturnalGenreCard(cards, userId);

        // 10. Red thread track
        addRedThreadTrackCard(cards, userId);

        return cards;
    }

    private void addAnchorGenreCard(List<StoryCard> cards, List<String> months, Map<String, Map<String, Double>> vectors, Set<String> allGenres) {
        String anchor = null;
        double bestScore = -1;
        int totalMonths = months.size();

        for (String genre : allGenres) {
            if (genre.equalsIgnoreCase("unknown")) continue;
            List<Double> shares = new ArrayList<>();
            int presentCount = 0;
            for (String m : months) {
                double share = vectors.get(m).getOrDefault(genre, 0.0);
                shares.add(share);
                if (share > 0) presentCount++;
            }
            double presence = (double) presentCount / totalMonths;
            double mean = shares.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double var = shares.stream().mapToDouble(s -> Math.pow(s - mean, 2)).average().orElse(0);

            double score = presence / (1.0 + var * 100);
            if (presence >= 0.6 && score > bestScore) {
                bestScore = score;
                anchor = genre;
            }
        }

        if (anchor != null) {
            cards.add(new StoryCard(
                    "ANCHOR_GENRE",
                    "Anchor Genre",
                    anchor,
                    anchor + " consistently accompanied you over the years — the anchor of your taste."
            ));
        }
    }

    private void addMeteorGenreCard(List<StoryCard> cards, List<String> months, Map<String, Map<String, Double>> vectors, Set<String> allGenres) {
        String meteor = null;
        String meteorMonth = null;
        double bestRatio = -1;

        for (String genre : allGenres) {
            if (genre.equalsIgnoreCase("unknown")) continue;
            double max = 0; String maxMonth = null;
            double sum = 0; int count = 0;
            for (String m : months) {
                double share = vectors.get(m).getOrDefault(genre, 0.0);
                if (share > max) { max = share; maxMonth = m; }
                sum += share; count++;
            }
            double mean = count > 0 ? sum / count : 0;
            if (mean <= 0) continue;
            double ratio = max / mean;

            if (max >= 0.3 && ratio > bestRatio) {
                bestRatio = ratio;
                meteor = genre;
                meteorMonth = maxMonth;
            }
        }

        if (meteor != null) {
            cards.add(new StoryCard(
                    "METEOR_GENRE",
                    "Meteor Genre",
                    meteor,
                    meteor + " spiked suddenly in " + humanMonth(meteorMonth) + ", then faded — a passing passion."
            ));
        }
    }

    private void addStabilityCards(List<StoryCard> cards, List<TasteShift> volatility) {
        Map<String, Double> distByYear = new TreeMap<>();
        Map<String, Integer> countByYear = new TreeMap<>();
        for (TasteShift s : volatility) {
            String year = s.toMonth().substring(0, 4);
            distByYear.merge(year, s.distance(), Double::sum);
            countByYear.merge(year, 1, Integer::sum);
        }
        Map<String, Double> avgByYear = new HashMap<>();
        for (String y : distByYear.keySet()) {
            if (countByYear.get(y) >= 6) { // Ensure at least 6 months of data to avoid partial year artifacts
                avgByYear.put(y, distByYear.get(y) / countByYear.get(y));
            }
        }
        if (avgByYear.size() < 1) return; // If we only have 1 valid full year, we can't compare, but still return without error

        avgByYear.entrySet().stream().min(Map.Entry.comparingByValue())
                .ifPresent(e -> cards.add(new StoryCard(
                        "MOST_STABLE_YEAR",
                        "Most Stable Year",
                        e.getKey(),
                        "In " + e.getKey() + " your taste was the most stable — few changes."
                )));

        avgByYear.entrySet().stream().max(Map.Entry.comparingByValue())
                .ifPresent(e -> cards.add(new StoryCard(
                        "MOST_EXPLORATORY_YEAR",
                        "Most Exploratory Year",
                        e.getKey(),
                        "In " + e.getKey() + " you explored the most — your taste shifted frequently."
                )));
    }

    private void addNocturnalGenreCard(List<StoryCard> cards, Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT g.genre_name AS genre, COUNT(f.fact_id) AS night_plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_time  t ON f.time_key  = t.time_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
                WHERE u.original_user_id = ? AND LOWER(t.part_of_day) = 'night' AND LOWER(g.genre_name) != 'unknown'
                GROUP BY g.genre_name
                ORDER BY night_plays DESC
                LIMIT 1
                """, userId);

        if (!rows.isEmpty()) {
            String genre = (String) rows.get(0).get("genre");
            cards.add(new StoryCard(
                    "NOCTURNAL_GENRE",
                    "Nocturnal Genre",
                    genre,
                    "This is the genre you listen to most frequently late at night."
            ));
        }
    }

    private void addRedThreadTrackCard(List<StoryCard> cards, Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT tr.track_name AS track_name,
                       ar.artist_name AS artist_name,
                       COUNT(DISTINCT (d.year || '-' || d.month)) AS months_count
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_track tr ON f.track_key = tr.track_key
                JOIN dw.dw_dim_artist ar ON f.artist_key = ar.artist_key
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                GROUP BY tr.track_name, ar.artist_name
                ORDER BY months_count DESC
                LIMIT 1
                """, userId);

        if (!rows.isEmpty()) {
            String track = (String) rows.get(0).get("track_name");
            String artist = (String) rows.get(0).get("artist_name");
            int count = ((Number) rows.get(0).get("months_count")).intValue();
            cards.add(new StoryCard(
                    "RED_THREAD_TRACK",
                    "Red Thread Track",
                    track,
                    String.format("The song \"%s\" by %s was present in %d different months of your listening history.", track, artist, count)
            ));
        }
    }

    private double round(double val, int decimals) {
        double scale = Math.pow(10, decimals);
        return Math.round(val * scale) / scale;
    }

    private String humanMonth(String yyyyMM) {
        if (yyyyMM == null || !yyyyMM.contains("-")) return yyyyMM;
        String[] parts = yyyyMM.split("-");
        try {
            int mIdx = Integer.parseInt(parts[1]) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                return MONTH_NAMES[mIdx] + " " + parts[0];
            }
        } catch (Exception e) {
            // fallback
        }
        return yyyyMM;
    }

    private String dominantGenre(Map<String, Double> vec) {
        if (vec == null || vec.isEmpty()) return null;
        return vec.entrySet().stream()
                .filter(e -> !e.getKey().equalsIgnoreCase("unknown"))
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    private String confidenceLabel(double r2) {
        if (r2 >= 0.6) return "HIGH";
        if (r2 >= 0.3) return "MEDIUM";
        return "LOW";
    }
}
