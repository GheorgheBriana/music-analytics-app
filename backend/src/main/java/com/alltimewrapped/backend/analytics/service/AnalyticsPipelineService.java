package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.service.OltpBackfillService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsPipelineService {

    private final OltpBackfillService oltpBackfillService;
    private final AnalyticsRefreshService analyticsRefreshService;

    public Map<String, Object> rebuildAnalyticsData(int backfillLimit, int refreshLimit) {
        Map<String, Object> result = new LinkedHashMap<>();

        Map<String, Object> backfillResult = oltpBackfillService.backfillTrackRelations(backfillLimit);

        Map<String, Object> warehouseResult = analyticsRefreshService.refreshWarehouse(refreshLimit);

        result.put("message", "Analytics pipeline completed successfully");
        result.put("backfillLimit", backfillLimit);
        result.put("refreshLimit", refreshLimit);
        result.put("oltpBackfill", backfillResult);
        result.put("warehouseRefresh", warehouseResult);

        return result;
    }
}