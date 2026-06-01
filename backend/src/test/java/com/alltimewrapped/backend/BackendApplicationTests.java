package com.alltimewrapped.backend;

import com.alltimewrapped.backend.dto.UserStatsResponse;
import com.alltimewrapped.backend.service.StatsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

@SpringBootTest
class BackendApplicationTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StatsService statsService;

    @Autowired
    private com.alltimewrapped.backend.service.ImportService importService;

    @Test
    void verifyPerformanceIndexesAndQueries() {
        System.out.println("\n==================================================");
        System.out.println("========== PERFORMANCE VERIFICATION TEST ==========");
        System.out.println("==================================================");

        try {
            // 1. Refresh PostgreSQL statistics
            System.out.println("\n[STEP 1] Running ANALYZE to refresh DB statistics...");
            jdbcTemplate.execute("ANALYZE dw.dw_fact_listening_event");
            System.out.println("ANALYZE completed successfully.");

            // 2. Verify physical index existence in PostgreSQL
            System.out.println("\n[STEP 2] Verifying physical index existence in 'dw' schema...");
            List<Map<String, Object>> indexes = jdbcTemplate.queryForList(
                    "SELECT indexname, tablename, indexdef " +
                    "FROM pg_indexes " +
                    "WHERE schemaname = 'dw' " +
                    "  AND indexname IN ('idx_dw_fact_user', 'idx_dw_fact_user_date', 'idx_dw_fact_original_record') " +
                    "ORDER BY indexname"
            );

            if (indexes.isEmpty()) {
                System.out.println("❌ No custom performance indexes found in 'dw' schema!");
            } else {
                System.out.println("✔ Found " + indexes.size() + " active indexes:");
                for (Map<String, Object> idx : indexes) {
                    System.out.println("  - Index: " + idx.get("indexname") + " on Table: " + idx.get("tablename"));
                }
            }

            // 3. Check what users exist in the database and their record counts
            System.out.println("\n[STEP 3] Fetching users and data volume from database...");
            List<Map<String, Object>> users = jdbcTemplate.queryForList(
                    "SELECT id, username, (SELECT COUNT(*) FROM oltp.listening_records WHERE user_id = u.id) AS oltp_cnt, " +
                    "COALESCE((SELECT COUNT(*) FROM dw.dw_fact_listening_event f JOIN dw.dw_dim_user du ON f.user_key = du.user_key WHERE du.original_user_id = u.id), 0) AS dw_cnt " +
                    "FROM oltp.app_users u"
            );

            Long activeUserId = null;
            for (Map<String, Object> u : users) {
                System.out.println("  User ID: " + u.get("id") + " (" + u.get("username") + ") | OLTP Records: " + u.get("oltp_cnt") + " | DW Facts: " + u.get("dw_cnt"));
                if (((Number) u.get("oltp_cnt")).longValue() > 0) {
                    activeUserId = ((Number) u.get("id")).longValue();
                }
            }

            // 4. Run EXPLAIN ANALYZE on a sample fact table count query
            System.out.println("\n[STEP 4] Running EXPLAIN ANALYZE on fact table count query...");
            List<String> plan = jdbcTemplate.query(
                    "EXPLAIN ANALYZE SELECT COUNT(*) FROM dw.dw_fact_listening_event WHERE user_key = 1",
                    (rs, rowNum) -> rs.getString(1)
            );
            for (String line : plan) {
                System.out.println("  " + line);
            }

            // Diagnostic prints for completion rate
            Long totalTracks = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.tracks", Long.class);
            Long tracksWithDuration = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.tracks WHERE duration_ms IS NOT NULL AND duration_ms > 0", Long.class);
            Long totalFacts = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dw.dw_fact_listening_event", Long.class);
            Long nonNullRate = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dw.dw_fact_listening_event WHERE completion_rate IS NOT NULL", Long.class);
            System.out.println("\n[DIAGNOSTICS] Database stats:");
            System.out.println("  - Total Tracks in OLTP: " + totalTracks);
            System.out.println("  - Tracks with valid duration: " + tracksWithDuration);
            System.out.println("  - Total DW Facts: " + totalFacts);
            System.out.println("  - DW Facts with non-null completion_rate: " + nonNullRate);

            // 5. Verify the actual loading speed of StatsService dashboard
            if (activeUserId != null) {
                System.out.println("\n[STEP 5] Timing StatsService.getUserStats() for User ID " + activeUserId + "...");
                long start = System.currentTimeMillis();
                UserStatsResponse stats = statsService.getUserStats(activeUserId, null, null);
                long duration = System.currentTimeMillis() - start;

                System.out.println("✔ User stats fetched in: " + duration + " ms");
                System.out.println("  - Total Plays in response: " + stats.getTotalPlays());
                System.out.println("  - Top Tracks size: " + (stats.getTop10Tracks() != null ? stats.getTop10Tracks().size() : 0));
                System.out.println("  - Top Artists size: " + (stats.getTop10Artists() != null ? stats.getTop10Artists().size() : 0));
            } else {
                System.out.println("\n[STEP 5] Skipped timing StatsService: No active users with records found.");
            }

        } catch (Exception e) {
            System.err.println("❌ Error during performance verification: " + e.getMessage());
            e.printStackTrace();
        }

        System.out.println("\n==================================================");
    }

    @Test
    void testRealZipImportSpeed() {
        System.out.println("\n==================================================");
        System.out.println("========== ZIP IMPORT SPEED TEST ==========");
        System.out.println("==================================================");

        try {
            java.io.File zipFile = new java.io.File("d:\\DISERTATIE\\music-analytics-app\\demo_spotify_history.zip");
            if (!zipFile.exists()) {
                System.out.println("❌ demo_spotify_history.zip not found at: " + zipFile.getAbsolutePath());
                return;
            }

            byte[] content = java.nio.file.Files.readAllBytes(zipFile.toPath());
            org.springframework.mock.web.MockMultipartFile multipartFile = new org.springframework.mock.web.MockMultipartFile(
                    "file",
                    "demo_spotify_history.zip",
                    "application/zip",
                    content
            );

            // Find or create a test user
            Long testUserId = null;
            List<Map<String, Object>> users = jdbcTemplate.queryForList("SELECT id FROM oltp.app_users LIMIT 1");
            if (!users.isEmpty()) {
                testUserId = ((Number) users.get(0).get("id")).longValue();
            } else {
                jdbcTemplate.update("INSERT INTO oltp.app_users (username, email, password_hash, role) VALUES ('test_importer', 'test@test.com', 'hash', 'USER')");
                testUserId = jdbcTemplate.queryForObject("SELECT id FROM oltp.app_users WHERE username = 'test_importer'", Long.class);
            }

            System.out.println("✔ Importing ZIP for User ID: " + testUserId);

            // Delete existing records to make a clean test
            int deleted = jdbcTemplate.update("DELETE FROM oltp.listening_records WHERE user_id = ?", testUserId);
            System.out.println("✔ Cleaned up " + deleted + " existing listening records for test user.");

            long startTime = System.currentTimeMillis();
            var result = importService.importSpotifyZip(multipartFile, testUserId);
            long endTime = System.currentTimeMillis();

            System.out.println("\n📊 --- IMPORT PERFORMANCE METRICS ---");
            System.out.println("✔ Files processed: " + result.getProcessedFiles());
            System.out.println("✔ Total records found: " + result.getTotalRecordsFound());
            System.out.println("✔ Imported records: " + result.getImportedRecords());
            System.out.println("✔ Duplicate records: " + result.getDuplicateRecords());
            System.out.println("✔ Skipped records: " + result.getSkippedRecords());
            System.out.println("✔ TOTAL IMPORT TIME: " + (endTime - startTime) + " ms");
            System.out.println("==================================================");

        } catch (Exception e) {
            System.err.println("❌ Error during ZIP import speed test: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Autowired
    private com.alltimewrapped.backend.analytics.service.AnalyticsRefreshService analyticsRefreshService;

    @Test
    void testFastSqlWarehouseRefresh() {
        System.out.println("\n==================================================");
        System.out.println("========== FAST SQL DW REFRESH TEST ==========");
        System.out.println("==================================================");

        try {
            // Find or create a test user
            Long testUserId = null;
            List<Map<String, Object>> users = jdbcTemplate.queryForList("SELECT id FROM oltp.app_users LIMIT 1");
            if (!users.isEmpty()) {
                testUserId = ((Number) users.get(0).get("id")).longValue();
            } else {
                jdbcTemplate.update("INSERT INTO oltp.app_users (username, email, password_hash, role) VALUES ('test_refresh', 'test_refresh@test.com', 'hash', 'USER')");
                testUserId = jdbcTemplate.queryForObject("SELECT id FROM oltp.app_users WHERE username = 'test_refresh'", Long.class);
            }

            System.out.println("✔ Target User ID for DW Refresh: " + testUserId);

            // Clean up any existing DW facts for this user to make a clean sync test
            jdbcTemplate.update(
                "DELETE FROM dw.dw_fact_listening_event WHERE user_key = (" +
                "  SELECT user_key FROM dw.dw_dim_user WHERE original_user_id = ?" +
                ")", testUserId
            );

            // Run a small test import of the ZIP first so that we have some records to refresh
            testRealZipImportSpeed();

            // Run the fast warehouse refresh
            long start = System.currentTimeMillis();
            Map<String, Object> result = analyticsRefreshService.refreshWarehouseForUser(testUserId, 20000);
            long duration = System.currentTimeMillis() - start;

            System.out.println("\n📊 --- REFRESH PERFORMANCE METRICS ---");
            System.out.println("✔ Sync Mode: " + result.get("mode"));
            System.out.println("✔ Limit: " + result.get("limit"));
            System.out.println("✔ Processed Records: " + result.get("processedRecords"));
            System.out.println("✔ Inserted Facts: " + result.get("insertedFacts"));
            System.out.println("✔ Skipped Invalid Records: " + result.get("skippedInvalidRecords"));
            System.out.println("✔ Total Facts in DW: " + result.get("totalFacts"));
            System.out.println("✔ REFRESH EXECUTION TIME: " + duration + " ms");

            org.junit.jupiter.api.Assertions.assertEquals("FAST_SQL", result.get("mode"));
            Number processed = (Number) result.get("processedRecords");
            Number inserted = (Number) result.get("insertedFacts");
            org.junit.jupiter.api.Assertions.assertNotNull(processed);
            org.junit.jupiter.api.Assertions.assertNotNull(inserted);

            // Verify idempotency (running again immediately should result in 0 processed/inserted)
            Map<String, Object> secondResult = analyticsRefreshService.refreshWarehouseForUser(testUserId, 20000);
            System.out.println("\n📊 --- SECOND RUN REFRESH METRICS (IDEMPOTENCY) ---");
            System.out.println("✔ Processed Records: " + secondResult.get("processedRecords"));
            System.out.println("✔ Inserted Facts: " + secondResult.get("insertedFacts"));

            org.junit.jupiter.api.Assertions.assertEquals(0, ((Number) secondResult.get("processedRecords")).intValue());
            org.junit.jupiter.api.Assertions.assertEquals(0, ((Number) secondResult.get("insertedFacts")).intValue());

            System.out.println("✔ Idempotency successfully verified. No duplicates created.");
            System.out.println("==================================================");

        } catch (Exception e) {
            System.err.println("❌ Error during fast SQL DW refresh test: " + e.getMessage());
            e.printStackTrace();
            org.junit.jupiter.api.Assertions.fail(e);
        }
    }
}
