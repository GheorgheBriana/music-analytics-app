package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.analytics.repository.*;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsStatusService {

    private final ListeningRecordRepository listeningRecordRepository;

    private final DwDimUserRepository dwDimUserRepository;
    private final DwDimTrackRepository dwDimTrackRepository;
    private final DwDimArtistRepository dwDimArtistRepository;
    private final DwDimAlbumRepository dwDimAlbumRepository;
    private final DwDimGenreRepository dwDimGenreRepository;
    private final DwDimDateRepository dwDimDateRepository;
    private final DwDimTimeRepository dwDimTimeRepository;
    private final DwDimPlatformRepository dwDimPlatformRepository;
    private final DwDimSourceRepository dwDimSourceRepository;
    private final DwFactListeningEventRepository dwFactListeningEventRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getWarehouseStatus() {
        long operationalListeningRecords = listeningRecordRepository.count();
        long warehouseFacts = dwFactListeningEventRepository.count();

        Map<String, Object> status = new LinkedHashMap<>();

        status.put("message", resolveStatusMessage(operationalListeningRecords, warehouseFacts));
        status.put("operationalListeningRecords", operationalListeningRecords);
        status.put("warehouseFacts", warehouseFacts);
        status.put("warehouseCoveragePercent", calculateCoveragePercent(operationalListeningRecords, warehouseFacts));

        Map<String, Object> dimensions = new LinkedHashMap<>();
        dimensions.put("users", dwDimUserRepository.count());
        dimensions.put("tracks", dwDimTrackRepository.count());
        dimensions.put("artists", dwDimArtistRepository.count());
        dimensions.put("albums", dwDimAlbumRepository.count());
        dimensions.put("genres", dwDimGenreRepository.count());
        dimensions.put("dates", dwDimDateRepository.count());
        dimensions.put("times", dwDimTimeRepository.count());
        dimensions.put("platforms", dwDimPlatformRepository.count());
        dimensions.put("sources", dwDimSourceRepository.count());

        status.put("dimensions", dimensions);
        status.put("readyForReports", warehouseFacts > 0);

        return status;
    }

    private String resolveStatusMessage(long operationalListeningRecords, long warehouseFacts) {
        if (operationalListeningRecords == 0) {
            return "No operational listening records found. Import Spotify data before building the warehouse.";
        }

        if (warehouseFacts == 0) {
            return "Operational data exists, but the Data Warehouse is empty. Run the analytics pipeline.";
        }

        if (warehouseFacts < operationalListeningRecords) {
            return "Data Warehouse is partially populated. Run the analytics pipeline again to process more records.";
        }

        return "Data Warehouse is fully populated and ready for analytics reports.";
    }

    private double calculateCoveragePercent(long operationalListeningRecords, long warehouseFacts) {
        if (operationalListeningRecords == 0) {
            return 0.0;
        }

        double percentage = (warehouseFacts * 100.0) / operationalListeningRecords;
        return Math.round(percentage * 100.0) / 100.0;
    }
}