package com.alltimewrapped.backend.admin.service;

import com.alltimewrapped.backend.admin.dto.AdminUserSummaryDto;
import com.alltimewrapped.backend.admin.dto.AdminDwStatsDto;
import com.alltimewrapped.backend.admin.dto.AdminEnrichmentStatusDto;
import com.alltimewrapped.backend.analytics.repository.*;
import com.alltimewrapped.backend.repository.*;
import com.alltimewrapped.backend.model.AppUser;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AppUserRepository appUserRepository;
    private final ListeningRecordRepository listeningRecordRepository;
    private final DwFactListeningEventRepository dwFactListeningEventRepository;
    private final DwDimUserRepository dwDimUserRepository;
    private final DwDimTrackRepository dwDimTrackRepository;
    private final DwDimArtistRepository dwDimArtistRepository;
    private final DwDimAlbumRepository dwDimAlbumRepository;
    private final DwDimGenreRepository dwDimGenreRepository;
    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<AdminUserSummaryDto> listAllUsers() {
        return appUserRepository.findAll().stream()
            .map(this::toUserSummary)
            .collect(Collectors.toList());
    }

    private AdminUserSummaryDto toUserSummary(AppUser user) {
        long records = listeningRecordRepository.countByUserId(user.getId());
        long facts = dwDimUserRepository.findByOriginalUserId(user.getId())
            .map(dim -> dwFactListeningEventRepository.countByUserKey(dim.getUserKey()))
            .orElse(0L);
        boolean spotifyConnected = user.getSpotifyAccessToken() != null
            && !user.getSpotifyAccessToken().isBlank();

        return AdminUserSummaryDto.builder()
            .id(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .role(user.getRole())
            .createdAt(user.getCreatedAt())
            .listeningRecordsCount(records)
            .factsInWarehouseCount(facts)
            .spotifyConnected(spotifyConnected)
            .build();
    }

    @Transactional(readOnly = true)
    public AdminDwStatsDto getDwStats() {
        Map<String, Long> factsByPartition = jdbcTemplate.queryForList(
            "SELECT '2023' AS year, COUNT(*) AS cnt FROM dw.dw_fact_listening_event_2023 " +
            "UNION ALL SELECT '2024', COUNT(*) FROM dw.dw_fact_listening_event_2024 " +
            "UNION ALL SELECT '2025', COUNT(*) FROM dw.dw_fact_listening_event_2025"
        ).stream().collect(Collectors.toMap(
            row -> (String) row.get("year"),
            row -> ((Number) row.get("cnt")).longValue()
        ));

        Map<String, Long> mvSizes = new HashMap<>();
        for (String mv : List.of("mv_monthly_listening", "mv_part_of_day_stats",
                "mv_weekend_vs_weekday_stats", "mv_top_genres", "mv_listening_heatmap")) {
            Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dw." + mv, Long.class);
            mvSizes.put(mv, count);
        }

        return AdminDwStatsDto.builder()
            .totalFacts(dwFactListeningEventRepository.count())
            .totalUsers(dwDimUserRepository.count())
            .totalTracks(dwDimTrackRepository.count())
            .totalArtists(dwDimArtistRepository.count())
            .totalAlbums(dwDimAlbumRepository.count())
            .totalGenres(dwDimGenreRepository.count())
            .factsByPartition(factsByPartition)
            .materializedViewSizes(mvSizes)
            .build();
    }

    @Transactional(readOnly = true)
    public AdminEnrichmentStatusDto getEnrichmentStatus() {
        long total = artistRepository.count();
        long enriched = artistRepository.countByGenreEnrichedTrue();
        long pending = total - enriched;
        long totalGenres = genreRepository.count();
        long totalLinks = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM oltp.track_genres", Long.class);

        return AdminEnrichmentStatusDto.builder()
            .totalArtists(total)
            .enrichedArtists(enriched)
            .pendingArtists(pending)
            .totalGenres(totalGenres)
            .totalTrackGenreLinks(totalLinks)
            .enrichmentProgressPercentage(total == 0 ? 0 : (enriched * 100.0) / total)
            .build();
    }
}
