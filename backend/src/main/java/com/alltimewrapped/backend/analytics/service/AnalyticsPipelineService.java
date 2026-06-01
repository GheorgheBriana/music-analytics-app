package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.service.OltpBackfillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsPipelineService {

    private final OltpBackfillService oltpBackfillService;
    private final AnalyticsRefreshService analyticsRefreshService;
    private final DwStatsService dwStatsService;

    public Map<String, Object> rebuildAnalyticsData(int backfillLimit, int refreshLimit) {
        log.info("========== [DW PIPELINE] Started ==========");
        log.info("[DW PIPELINE] Configuration: backfillLimit={}, refreshLimit={}", backfillLimit, refreshLimit);
        long startTime = System.currentTimeMillis();

        // 1. OLTP Track relations backfill
        log.info("[DW PIPELINE] Step 1: OLTP track relations backfill started (Limit: {})", backfillLimit);
        long backfillStart = System.currentTimeMillis();
        Map<String, Object> backfillResult = oltpBackfillService.backfillTrackRelations(backfillLimit);
        long backfillDuration = System.currentTimeMillis() - backfillStart;
        log.info("[DW PIPELINE] Step 1: OLTP track relations backfill finished in {} ms.", backfillDuration);

        // 2. Analytics DW refresh
        log.info("[DW PIPELINE] Step 2: DW facts & dimensions refresh started (Limit: {})", refreshLimit);
        long refreshStart = System.currentTimeMillis();
        Map<String, Object> warehouseResult = analyticsRefreshService.refreshWarehouse(refreshLimit);
        long refreshDuration = System.currentTimeMillis() - refreshStart;
        log.info("[DW PIPELINE] Step 2: DW facts & dimensions refresh finished in {} ms.", refreshDuration);

        // 3. Materialized views refresh
        log.info("[DW PIPELINE] Step 3: Materialized views refresh started");
        long mvStart = System.currentTimeMillis();
        boolean viewsRefreshed = false;
        String mvError = null;
        try {
            dwStatsService.refreshMaterializedViews();
            viewsRefreshed = true;
            warehouseResult.put("viewsRefreshed", true);
            long mvDuration = System.currentTimeMillis() - mvStart;
            log.info("[DW PIPELINE] Step 3: Materialized views refresh finished in {} ms", mvDuration);
        } catch (Exception e) {
            mvError = e.getMessage();
            warehouseResult.put("viewsRefreshed", false);
            warehouseResult.put("viewsRefreshError", mvError);
            long mvDuration = System.currentTimeMillis() - mvStart;
            log.error("[DW PIPELINE] Step 3: Materialized views refresh FAILED in {} ms. Error: {}", mvDuration, mvError, e);
        }

        long totalDuration = System.currentTimeMillis() - startTime;
        log.info("========== [DW PIPELINE] Completed in {} ms ==========", totalDuration);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Analytics pipeline completed successfully");
        result.put("backfillLimit", backfillLimit);
        result.put("refreshLimit", refreshLimit);
        result.put("totalDurationMs", totalDuration);
        result.put("oltpBackfill", backfillResult);
        result.put("warehouseRefresh", warehouseResult);

        return result;
    }
}