package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PredictionService {

    private final AppUserRepository appUserRepository;
    private final JdbcTemplate jdbcTemplate;

    private static final String[] MONTH_NAMES = {
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    };
    private static final String[] DAY_NAMES = {
        "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"
    };
    private static final double RECENCY_DECAY = 0.7;     // half-life ~2 months
    private static final double ANOMALY_THRESHOLD = 2.0; // |z| > 2 = anomaly

    @Transactional(readOnly = true)
    public PredictionResponse getPredictions(Long userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        // Verifică dacă user-ul are date în DW
        Integer totalPlays = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                """, Integer.class, userId);

        if (totalPlays == null || totalPlays == 0) {
            return emptyResponse();
        }

        // 1. Top artist cu recency weighting
        PredictedItem topArtist = predictTopArtistWithDecay(userId);

        // 2. Distribuții probabilistice
        Map<String, Double> dayProbs = dayOfWeekProbabilities(userId);
        Map<Integer, Double> hourProbs = hourProbabilities(userId);
        Map<String, Double> monthProbs = monthProbabilities(userId);

        // 3. Trend prin regresie liniară + R²
        TrendAnalysis trend = analyzeTrendWithRegression(userId);

        // 4. Forecast pentru luna următoare cu 95% CI
        Forecast forecast = forecastNextMonth(userId, trend);

        // 5. Anomalii Z-score
        List<Anomaly> anomalies = detectAnomalies(userId);

        // 6. Traiectorii genuri
        List<GenreTrajectory> allTrajectories = computeGenreTrajectories(userId);
        List<GenreTrajectory> rising = allTrajectories.stream()
                .filter(g -> "RISING".equals(g.direction())).limit(3).toList();
        List<GenreTrajectory> fading = allTrajectories.stream()
                .filter(g -> "FADING".equals(g.direction())).limit(3).toList();

        // 7. Argmax simple (backward compat)
        String topDay = argmax(dayProbs, "No data yet");
        Integer topHour = argmaxInt(hourProbs);
        String topMonth = argmax(monthProbs, "No data yet");
        Double changePercent = calculateChangePercent(userId);

        return new PredictionResponse(
            topArtist, dayProbs, hourProbs, monthProbs,
            trend, forecast, anomalies, rising, fading,
            topDay, topHour, topMonth, trend.direction(), changePercent
        );
    }

    // ====================================================================
    // 1. RECENCY-WEIGHTED TOP ARTIST
    // Folosește exponential decay: artiști recenți contează mai mult
    // weight(month_diff) = decay^month_diff
    // ====================================================================
    private PredictedItem predictTopArtistWithDecay(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    a.artist_name AS name,
                    EXTRACT(YEAR FROM d.full_date)::INT AS year,
                    EXTRACT(MONTH FROM d.full_date)::INT AS month,
                    COUNT(*)::DOUBLE PRECISION AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                WHERE u.original_user_id = ?
                GROUP BY a.artist_name, EXTRACT(YEAR FROM d.full_date), EXTRACT(MONTH FROM d.full_date)
                """, userId);

        if (rows.isEmpty()) {
            return new PredictedItem("No data yet", 0.0, "LOW");
        }

        int latestMonthIdx = rows.stream()
                .mapToInt(r -> ((Number) r.get("year")).intValue() * 12 + ((Number) r.get("month")).intValue())
                .max().orElse(0);

        Map<String, Double> weightedScores = new HashMap<>();
        for (Map<String, Object> r : rows) {
            int monthIdx = ((Number) r.get("year")).intValue() * 12 + ((Number) r.get("month")).intValue();
            double plays = ((Number) r.get("plays")).doubleValue();
            String name = (String) r.get("name");
            double weight = Math.pow(RECENCY_DECAY, latestMonthIdx - monthIdx);
            weightedScores.merge(name, plays * weight, Double::sum);
        }

        double totalWeighted = weightedScores.values().stream().mapToDouble(Double::doubleValue).sum();
        Map.Entry<String, Double> top = weightedScores.entrySet().stream()
                .max(Map.Entry.comparingByValue()).orElseThrow();

        double confidence = totalWeighted > 0 ? top.getValue() / totalWeighted : 0;
        return new PredictedItem(top.getKey(), confidence, confidenceLabel(confidence, 0.15, 0.30));
    }

    // ====================================================================
    // 2-4. DISTRIBUȚII PROBABILISTICE
    // PMF: p(x) = freq(x) / total
    // ====================================================================
    private Map<String, Double> dayOfWeekProbabilities(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT day_of_week, SUM(total_plays)::DOUBLE PRECISION AS plays
                FROM dw.mv_listening_heatmap
                WHERE original_user_id = ?
                GROUP BY day_of_week
                """, userId);

        double total = rows.stream().mapToDouble(r -> ((Number) r.get("plays")).doubleValue()).sum();
        Map<String, Double> probs = new LinkedHashMap<>();
        for (int i = 0; i < 7; i++) probs.put(DAY_NAMES[i], 0.0);

        for (Map<String, Object> r : rows) {
            int dow = ((Number) r.get("day_of_week")).intValue();
            int idx = (dow == 0) ? 6 : dow - 1;  // postgres 0=Sun -> our 6=Sun
            double plays = ((Number) r.get("plays")).doubleValue();
            probs.put(DAY_NAMES[idx], total > 0 ? plays / total : 0);
        }
        return probs;
    }

    private Map<Integer, Double> hourProbabilities(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT hour, SUM(total_plays)::DOUBLE PRECISION AS plays
                FROM dw.mv_listening_heatmap
                WHERE original_user_id = ?
                GROUP BY hour
                """, userId);

        double total = rows.stream().mapToDouble(r -> ((Number) r.get("plays")).doubleValue()).sum();
        Map<Integer, Double> probs = new LinkedHashMap<>();
        for (int h = 0; h < 24; h++) probs.put(h, 0.0);

        for (Map<String, Object> r : rows) {
            int hour = ((Number) r.get("hour")).intValue();
            double plays = ((Number) r.get("plays")).doubleValue();
            probs.put(hour, total > 0 ? plays / total : 0);
        }
        return probs;
    }

    private Map<String, Double> monthProbabilities(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT month, SUM(total_plays)::DOUBLE PRECISION AS plays
                FROM dw.mv_monthly_listening
                WHERE original_user_id = ?
                GROUP BY month
                """, userId);

        double total = rows.stream().mapToDouble(r -> ((Number) r.get("plays")).doubleValue()).sum();
        Map<String, Double> probs = new LinkedHashMap<>();
        for (int m = 1; m <= 12; m++) probs.put(MONTH_NAMES[m - 1], 0.0);

        for (Map<String, Object> r : rows) {
            int month = ((Number) r.get("month")).intValue();
            double plays = ((Number) r.get("plays")).doubleValue();
            probs.put(MONTH_NAMES[month - 1], total > 0 ? plays / total : 0);
        }
        return probs;
    }

    // ====================================================================
    // 5. REGRESIE LINIARĂ + R² + PROIECTARE 3 LUNI
    // y = mx + b, calculated via least squares
    // R² = 1 - SS_res / SS_tot
    // ====================================================================
    private TrendAnalysis trendByRegression(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT year, month, SUM(total_plays)::DOUBLE PRECISION AS plays
                FROM dw.mv_monthly_listening
                WHERE original_user_id = ?
                GROUP BY year, month
                ORDER BY year, month
                """, userId);

        if (rows.size() < 3) {
            return new TrendAnalysis("STABLE", 0, 0, "LOW", List.of(), List.of());
        }

        int n = rows.size();
        double[] x = new double[n];
        double[] y = new double[n];
        String[] labels = new String[n];
        for (int i = 0; i < n; i++) {
            x[i] = i;
            y[i] = ((Number) rows.get(i).get("plays")).doubleValue();
            int year = ((Number) rows.get(i).get("year")).intValue();
            int month = ((Number) rows.get(i).get("month")).intValue();
            labels[i] = year + "-" + String.format("%02d", month);
        }

        // Least squares regression
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (int i = 0; i < n; i++) {
            sumX += x[i]; sumY += y[i];
            sumXY += x[i] * y[i]; sumX2 += x[i] * x[i];
        }
        double slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        double intercept = (sumY - slope * sumX) / n;
        double meanY = sumY / n;

        // R² coefficient
        double ssRes = 0, ssTot = 0;
        for (int i = 0; i < n; i++) {
            double yHat = slope * x[i] + intercept;
            ssRes += Math.pow(y[i] - yHat, 2);
            ssTot += Math.pow(y[i] - meanY, 2);
        }
        double rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

        // Historical series with fitted line
        List<TrendPoint> historical = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            historical.add(new TrendPoint(labels[i], y[i], slope * x[i] + intercept));
        }

        // Projected 3 months forward
        List<TrendPoint> projected = new ArrayList<>();
        int[] lastYM = parseYM(labels[n - 1]);
        for (int k = 1; k <= 3; k++) {
            double xNew = n - 1 + k;
            double yProj = Math.max(0, slope * xNew + intercept);
            int[] nextYM = addMonths(lastYM, k);
            projected.add(new TrendPoint(
                nextYM[0] + "-" + String.format("%02d", nextYM[1]), -1, yProj));
        }

        // Direction classification (relative to mean)
        String direction;
        double threshold = meanY * 0.05;
        if (slope > threshold) direction = "INCREASING";
        else if (slope < -threshold) direction = "DECREASING";
        else direction = "STABLE";

        return new TrendAnalysis(
            direction, slope, rSquared,
            confidenceLabel(rSquared, 0.3, 0.6),
            historical, projected
        );
    }

    private TrendAnalysis analyzeTrendWithRegression(Long userId) {
        return trendByRegression(userId);
    }

    // ====================================================================
    // 6. FORECAST CU 95% CONFIDENCE INTERVAL
    // CI = ŷ ± 1.96 * SE * sqrt(1 + 1/n + (x_new - x̄)²/Σ(xi - x̄)²)
    // ====================================================================
    private Forecast forecastNextMonth(Long userId, TrendAnalysis trend) {
        if (trend.historicalSeries().size() < 3) {
            return new Forecast(0, 0, 0, "Not enough data");
        }

        int n = trend.historicalSeries().size();
        double[] y = trend.historicalSeries().stream().mapToDouble(TrendPoint::actual).toArray();
        double[] x = new double[n];
        for (int i = 0; i < n; i++) x[i] = i;

        double meanX = (n - 1) / 2.0;
        double meanY = Arrays.stream(y).average().orElse(0);
        double sumSqResid = 0, sumSqX = 0;
        for (int i = 0; i < n; i++) {
            double yHat = trend.historicalSeries().get(i).fitted();
            sumSqResid += Math.pow(y[i] - yHat, 2);
            sumSqX += Math.pow(x[i] - meanX, 2);
        }
        double se = n > 2 ? Math.sqrt(sumSqResid / (n - 2)) : 0;

        double xNew = n;
        double yPred = !trend.projectedSeries().isEmpty()
                ? trend.projectedSeries().get(0).fitted() : 0;
        double margin = 1.96 * se * Math.sqrt(1.0 + 1.0/n + Math.pow(xNew - meanX, 2)/Math.max(sumSqX, 1e-9));

        String period = !trend.projectedSeries().isEmpty()
                ? "Next month: " + trend.projectedSeries().get(0).label() : "Next month";

        return new Forecast(
            Math.round(yPred),
            Math.max(0, Math.round(yPred - margin)),
            Math.round(yPred + margin),
            period
        );
    }

    // ====================================================================
    // 7. ANOMALY DETECTION via Z-SCORE
    // z = (x - μ) / σ, anomaly if |z| > 2
    // ====================================================================
    private List<Anomaly> detectAnomalies(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT year, month, SUM(total_plays)::DOUBLE PRECISION AS plays
                FROM dw.mv_monthly_listening
                WHERE original_user_id = ?
                GROUP BY year, month
                ORDER BY year, month
                """, userId);

        if (rows.size() < 3) return List.of();

        double[] plays = rows.stream()
                .mapToDouble(r -> ((Number) r.get("plays")).doubleValue()).toArray();
        double mean = Arrays.stream(plays).average().orElse(0);
        double variance = Arrays.stream(plays).map(v -> Math.pow(v - mean, 2)).average().orElse(0);
        double stddev = Math.sqrt(variance);
        if (stddev == 0) return List.of();

        List<Anomaly> anomalies = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            double z = (plays[i] - mean) / stddev;
            if (Math.abs(z) > ANOMALY_THRESHOLD) {
                int year = ((Number) rows.get(i).get("year")).intValue();
                int month = ((Number) rows.get(i).get("month")).intValue();
                anomalies.add(new Anomaly(
                    MONTH_NAMES[month - 1] + " " + year,
                    plays[i],
                    Math.round(z * 100.0) / 100.0,
                    z > 0 ? "PEAK" : "DROP"
                ));
            }
        }
        anomalies.sort((a, b) -> Double.compare(Math.abs(b.zScore()), Math.abs(a.zScore())));
        return anomalies.stream().limit(5).toList();
    }

    // ====================================================================
    // 8. GENRE TRAJECTORIES — slope per gen
    // Regresie liniară pe fiecare gen pentru a vedea trend-ul
    // ====================================================================
    private List<GenreTrajectory> computeGenreTrajectories(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    g.genre_name AS name,
                    EXTRACT(YEAR FROM d.full_date)::INT AS year,
                    EXTRACT(MONTH FROM d.full_date)::INT AS month,
                    COUNT(*)::DOUBLE PRECISION AS plays
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                WHERE u.original_user_id = ?
                  AND g.genre_name != 'unknown'
                GROUP BY g.genre_name, EXTRACT(YEAR FROM d.full_date), EXTRACT(MONTH FROM d.full_date)
                """, userId);

        // Group by genre
        Map<String, List<double[]>> perGenre = new HashMap<>();
        for (Map<String, Object> r : rows) {
            String name = (String) r.get("name");
            double x = ((Number) r.get("year")).intValue() * 12 + ((Number) r.get("month")).intValue();
            double y = ((Number) r.get("plays")).doubleValue();
            perGenre.computeIfAbsent(name, k -> new ArrayList<>()).add(new double[]{x, y});
        }

        List<GenreTrajectory> result = new ArrayList<>();
        for (Map.Entry<String, List<double[]>> e : perGenre.entrySet()) {
            List<double[]> points = e.getValue();
            if (points.size() < 3) continue;

            double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            int n = points.size();
            for (double[] p : points) {
                sumX += p[0]; sumY += p[1];
                sumXY += p[0] * p[1]; sumX2 += p[0] * p[0];
            }
            double denom = n * sumX2 - sumX * sumX;
            if (denom == 0) continue;
            double slope = (n * sumXY - sumX * sumY) / denom;
            double avgPlays = sumY / n;

            // Filter out tiny genres
            if (avgPlays < 5) continue;

            String direction = slope > avgPlays * 0.1 ? "RISING"
                    : slope < -avgPlays * 0.1 ? "FADING" : "STABLE";

            if (!"STABLE".equals(direction)) {
                result.add(new GenreTrajectory(
                    e.getKey(),
                    Math.round(slope * 100.0) / 100.0,
                    Math.round(avgPlays * 100.0) / 100.0,
                    direction
                ));
            }
        }

        result.sort((a, b) -> Double.compare(Math.abs(b.slope()), Math.abs(a.slope())));
        return result;
    }

    // ====================================================================
    // HELPERS
    // ====================================================================
    private Double calculateChangePercent(Long userId) {
        try {
            Map<String, Object> r = jdbcTemplate.queryForMap("""
                    WITH years AS (
                        SELECT DISTINCT year FROM dw.mv_monthly_listening
                        WHERE original_user_id = ?
                        ORDER BY year DESC LIMIT 2
                    )
                    SELECT
                        COALESCE((SELECT SUM(total_plays) FROM dw.mv_monthly_listening
                                  WHERE original_user_id = ? AND year = (SELECT MAX(year) FROM years)), 0)::DOUBLE PRECISION AS latest,
                        COALESCE((SELECT SUM(total_plays) FROM dw.mv_monthly_listening
                                  WHERE original_user_id = ? AND year = (SELECT MIN(year) FROM years)), 0)::DOUBLE PRECISION AS previous
                    """, userId, userId, userId);
            double latest = ((Number) r.get("latest")).doubleValue();
            double previous = ((Number) r.get("previous")).doubleValue();
            if (previous == 0) return 0.0;
            return Math.round(((latest - previous) / previous) * 10000.0) / 100.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private String confidenceLabel(double value, double low, double high) {
        if (value >= high) return "HIGH";
        if (value >= low) return "MEDIUM";
        return "LOW";
    }

    private <K> String argmax(Map<K, Double> map, String fallback) {
        return map.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(e -> e.getKey().toString())
                .orElse(fallback);
    }

    private Integer argmaxInt(Map<Integer, Double> map) {
        return map.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey).orElse(null);
    }

    private int[] parseYM(String label) {
        String[] parts = label.split("-");
        return new int[]{Integer.parseInt(parts[0]), Integer.parseInt(parts[1])};
    }

    private int[] addMonths(int[] ym, int months) {
        int total = ym[0] * 12 + (ym[1] - 1) + months;
        return new int[]{total / 12, total % 12 + 1};
    }

    private PredictionResponse emptyResponse() {
        return new PredictionResponse(
            new PredictedItem("No data yet", 0, "LOW"),
            Map.of(), Map.of(), Map.of(),
            new TrendAnalysis("STABLE", 0, 0, "LOW", List.of(), List.of()),
            new Forecast(0, 0, 0, "No data"),
            List.of(), List.of(), List.of(),
            "No data yet", null, "No data yet", "STABLE", 0.0
        );
    }
}