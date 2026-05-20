package com.alltimewrapped.backend.analytics.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsValidationService {

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> validateWarehouse() {
        Map<String, Object> result = new LinkedHashMap<>();

        long operationalRecords = getLongValue("""
                SELECT COUNT(*)
                FROM oltp.listening_records
                """);

        long warehouseFacts = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event
                """);

        long duplicateFacts = getLongValue("""
                SELECT COUNT(*)
                FROM (
                    SELECT original_listening_record_id
                    FROM dw.dw_fact_listening_event
                    GROUP BY original_listening_record_id
                    HAVING COUNT(*) > 1
                ) duplicates
                """);

        long unknownArtists = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_artist a ON f.artist_key = a.artist_key
                WHERE a.original_artist_id = -1
                """);

        long unknownAlbums = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_album a ON f.album_key = a.album_key
                WHERE a.original_album_id = -1
                """);

        long unknownGenres = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
                WHERE g.original_genre_id = -1
                """);

        long factsWithoutDate = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event
                WHERE date_key IS NULL
                """);

        long factsWithoutTime = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event
                WHERE time_key IS NULL
                """);

        long factsWithoutTrack = getLongValue("""
                SELECT COUNT(*)
                FROM dw.dw_fact_listening_event
                WHERE track_key IS NULL
                """);

        double coveragePercent = calculateCoveragePercent(operationalRecords, warehouseFacts);

        boolean valid = duplicateFacts == 0
                && factsWithoutDate == 0
                && factsWithoutTime == 0
                && factsWithoutTrack == 0
                && warehouseFacts > 0;

        result.put("message", buildValidationMessage(operationalRecords, warehouseFacts, valid));
        result.put("valid", valid);

        result.put("operationalRecords", operationalRecords);
        result.put("warehouseFacts", warehouseFacts);
        result.put("coveragePercent", coveragePercent);

        Map<String, Object> qualityChecks = new LinkedHashMap<>();
        qualityChecks.put("duplicateFacts", duplicateFacts);
        qualityChecks.put("factsWithoutDate", factsWithoutDate);
        qualityChecks.put("factsWithoutTime", factsWithoutTime);
        qualityChecks.put("factsWithoutTrack", factsWithoutTrack);

        Map<String, Object> fallbackDimensions = new LinkedHashMap<>();
        fallbackDimensions.put("unknownArtists", unknownArtists);
        fallbackDimensions.put("unknownAlbums", unknownAlbums);
        fallbackDimensions.put("unknownGenres", unknownGenres);

        result.put("qualityChecks", qualityChecks);
        result.put("fallbackDimensions", fallbackDimensions);
        result.put("readyForReports", warehouseFacts > 0 && duplicateFacts == 0);

        return result;
    }

    private long getLongValue(String sql) {
        Number value = jdbcTemplate.queryForObject(sql, Number.class);
        return value != null ? value.longValue() : 0L;
    }

    private double calculateCoveragePercent(long operationalRecords, long warehouseFacts) {
        if (operationalRecords == 0) {
            return 0.0;
        }

        double percentage = (warehouseFacts * 100.0) / operationalRecords;
        return Math.round(percentage * 100.0) / 100.0;
    }

    private String buildValidationMessage(long operationalRecords, long warehouseFacts, boolean valid) {
        if (operationalRecords == 0) {
            return "No operational listening records found. Import Spotify data first.";
        }

        if (warehouseFacts == 0) {
            return "Data Warehouse is empty. Run the analytics pipeline before generating reports.";
        }

        if (!valid) {
            return "Data Warehouse contains data, but some validation checks require attention.";
        }

        return "Data Warehouse validation passed successfully.";
    }
}
