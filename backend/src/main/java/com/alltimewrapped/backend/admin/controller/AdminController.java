package com.alltimewrapped.backend.admin.controller;

import com.alltimewrapped.backend.admin.dto.AdminUserSummaryDto;
import com.alltimewrapped.backend.admin.dto.AdminDwStatsDto;
import com.alltimewrapped.backend.admin.dto.AdminEnrichmentStatusDto;
import com.alltimewrapped.backend.admin.dto.AdminDataQualityDto;
import com.alltimewrapped.backend.admin.model.AdminActionLog;
import com.alltimewrapped.backend.admin.service.AdminService;
import com.alltimewrapped.backend.analytics.service.AnalyticsRefreshService;
import com.alltimewrapped.backend.analytics.service.DwStatsService;
import com.alltimewrapped.backend.analytics.service.MusicBrainzEnrichmentService;
import com.alltimewrapped.backend.analytics.service.AnalyticsPipelineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin", description = "Administrative endpoints for managing users, Data Warehouse, and Enrichment")
public class AdminController {

    private final AdminService adminService;
    private final AnalyticsRefreshService analyticsRefreshService;
    private final DwStatsService dwStatsService;
    private final MusicBrainzEnrichmentService musicBrainzEnrichmentService;
    private final AnalyticsPipelineService analyticsPipelineService;

    // ============ USERS ============

    @GetMapping("/users")
    @Operation(summary = "List all users", description = "Retrieves a summary of all registered users including their listening records and DW facts counts.")
    public List<AdminUserSummaryDto> listAllUsers() {
        return adminService.listAllUsers();
    }

    // ============ DATA WAREHOUSE ============

    @GetMapping("/dw/stats")
    @Operation(summary = "Get Data Warehouse Stats", description = "Retrieves aggregate statistics and partition sizes for the Data Warehouse.")
    public AdminDwStatsDto getDwStats() {
        return adminService.getDwStats();
    }

    @PostMapping("/dw/refresh")
    @Operation(summary = "Refresh Warehouse", description = "Triggers an incremental rebuild of the Data Warehouse from OLTP records.")
    public Map<String, Object> refreshWarehouse(
            @RequestHeader("X-User-Id") Long adminUserId,
            @RequestParam(defaultValue = "20000") int limit) {
        try {
            Map<String, Object> result = analyticsRefreshService.refreshWarehouse(limit);
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE", "limit=" + limit, "SUCCESS");
            return result;
        } catch (Exception e) {
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE", "limit=" + limit + " | error=" + e.getMessage(), "FAILED");
            throw e;
        }
    }

    @PostMapping("/dw/pipeline/rebuild")
    @Operation(summary = "Run Data Warehouse Pipeline", description = "Triggers backfilling of track relations and rebuilding of the Data Warehouse.")
    public Map<String, Object> runPipeline(
            @RequestHeader("X-User-Id") Long adminUserId,
            @RequestParam(defaultValue = "20000") int backfillLimit,
            @RequestParam(defaultValue = "20000") int refreshLimit) {
        try {
            log.info("Admin {} triggered DW pipeline backfill={}, refresh={}", adminUserId, backfillLimit, refreshLimit);
            Map<String, Object> result = analyticsPipelineService.rebuildAnalyticsData(backfillLimit, refreshLimit);
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE", "backfillLimit=" + backfillLimit + " | refreshLimit=" + refreshLimit, "SUCCESS");
            return result;
        } catch (Exception e) {
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE", "backfillLimit=" + backfillLimit + " | refreshLimit=" + refreshLimit + " | error=" + e.getMessage(), "FAILED");
            throw e;
        }
    }

    @PostMapping("/dw/refresh/user/{targetUserId}")
    @Operation(summary = "Sync DW for user", description = "Triggers an incremental sync of the Data Warehouse from OLTP records for a specific user.")
    public Map<String, Object> refreshWarehouseForUser(
            @RequestHeader("X-User-Id") Long adminUserId,
            @PathVariable Long targetUserId,
            @RequestParam(defaultValue = "20000") int limit) {
        try {
            Map<String, Object> result = analyticsRefreshService.refreshWarehouseForUser(targetUserId, limit);
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE_USER", "targetUserId=" + targetUserId + " | limit=" + limit, "SUCCESS");
            return result;
        } catch (Exception e) {
            adminService.logAction(adminUserId, "RUN_DW_PIPELINE_USER", "targetUserId=" + targetUserId + " | limit=" + limit + " | error=" + e.getMessage(), "FAILED");
            throw e;
        }
    }

    @PostMapping("/dw/refresh-mvs")
    @Operation(summary = "Refresh Materialized Views", description = "Refreshes all PostgreSQL materialized views in the Data Warehouse.")
    public Map<String, Object> refreshMaterializedViews(@RequestHeader("X-User-Id") Long adminUserId) {
        try {
            dwStatsService.refreshMaterializedViews();
            adminService.logAction(adminUserId, "REFRESH_MATERIALIZED_VIEWS", "", "SUCCESS");
            return Map.of("message", "Materialized views refreshed successfully");
        } catch (Exception e) {
            adminService.logAction(adminUserId, "REFRESH_MATERIALIZED_VIEWS", "error=" + e.getMessage(), "FAILED");
            throw e;
        }
    }

    @GetMapping("/dw/quality")
    @Operation(summary = "Get Data Quality Stats", description = "Retrieves data quality metrics for the Admin Dashboard.")
    public AdminDataQualityDto getDataQualityStats() {
        return adminService.getDataQualityStats();
    }

    @GetMapping("/actions/recent")
    @Operation(summary = "Get Recent Admin Actions", description = "Retrieves the 10 most recent admin actions.")
    public List<AdminActionLog> getRecentActions() {
        return adminService.getRecentActions();
    }

    // ============ ENRICHMENT ============

    @GetMapping("/enrichment/status")
    @Operation(summary = "Get Enrichment Status", description = "Retrieves current progress on fetching artist tags and genres from MusicBrainz.")
    public AdminEnrichmentStatusDto getEnrichmentStatus() {
        return adminService.getEnrichmentStatus();
    }

    @PostMapping("/enrichment/trigger")
    @Operation(summary = "Trigger Enrichment", description = "Triggers the MusicBrainz enrichment process for pending artists.")
    public Map<String, Object> triggerEnrichment(
            @RequestHeader("X-User-Id") Long adminUserId,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            Map<String, Object> result = musicBrainzEnrichmentService.enrichArtists(limit);
            adminService.logAction(adminUserId, "RUN_MUSICBRAINZ_ENRICHMENT", "limit=" + limit, "SUCCESS");
            return result;
        } catch (Exception e) {
            adminService.logAction(adminUserId, "RUN_MUSICBRAINZ_ENRICHMENT", "limit=" + limit + " | error=" + e.getMessage(), "FAILED");
            throw e;
        }
    }

    // ============ SCHEMA EXPLORER ============

    @GetMapping("/schema/tables/oltp")
    @Operation(summary = "Get OLTP Tables", description = "Retrieves a list of all BASE tables in the OLTP schema.")
    public List<Map<String, Object>> getOltpTables() {
        return adminService.getOltpTables();
    }

    @GetMapping("/schema/tables/dw")
    @Operation(summary = "Get DW Tables", description = "Retrieves a list of all BASE tables in the DW schema.")
    public List<Map<String, Object>> getDwTables() {
        return adminService.getDwTables();
    }

    @GetMapping("/schema/materialized-views")
    @Operation(summary = "Get Materialized Views", description = "Retrieves a list of all materialized views in the DW schema.")
    public List<Map<String, Object>> getMaterializedViews() {
        return adminService.getMaterializedViews();
    }

    @GetMapping("/schema/indexes/dw")
    @Operation(summary = "Get DW Indexes", description = "Retrieves a list of all indexes in the DW schema.")
    public List<Map<String, Object>> getDwIndexes() {
        return adminService.getDwIndexes();
    }

    @GetMapping("/schema/partitions")
    @Operation(summary = "Get DW Partitions", description = "Retrieves a list of all partition tables and estimated rows for the DW facts.")
    public List<Map<String, Object>> getPartitions() {
        return adminService.getPartitions();
    }
}
