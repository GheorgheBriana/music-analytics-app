package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.service.OltpBackfillService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/maintenance")
@RequiredArgsConstructor
public class OltpBackfillController {

    private final OltpBackfillService oltpBackfillService;

    @PostMapping("/backfill-oltp")
    public Map<String, Object> backfillOltp(
            @RequestParam(defaultValue = "200") int limit
    ) {
        return oltpBackfillService.backfillTrackRelations(limit);
    }
}