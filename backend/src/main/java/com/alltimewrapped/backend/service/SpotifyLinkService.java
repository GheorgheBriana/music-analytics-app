package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.ListeningSource;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import com.alltimewrapped.backend.analytics.service.AnalyticsRefreshService;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SpotifyLinkService {

    private final AppUserRepository appUserRepository;
    private final ListeningRecordRepository listeningRecordRepository;
    private final TrackService trackService;
    private final JdbcTemplate jdbcTemplate;
    private final AnalyticsRefreshService analyticsRefreshService;

    public SpotifyLinkService(AppUserRepository appUserRepository,
                              ListeningRecordRepository listeningRecordRepository,
                              TrackService trackService,
                              JdbcTemplate jdbcTemplate,
                              AnalyticsRefreshService analyticsRefreshService) {
        this.appUserRepository = appUserRepository;
        this.listeningRecordRepository = listeningRecordRepository;
        this.trackService = trackService;
        this.jdbcTemplate = jdbcTemplate;
        this.analyticsRefreshService = analyticsRefreshService;
    }

    /**
     * Sincronizează ascultările recente din Spotify pentru un user deja conectat.
     */
    @Transactional
    public Map<String, Object> syncRecentlyPlayed(Long userId) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User inexistent"));

        // Userul trebuie să aibă Spotify legat (token valid).
        if (user.getSpotifyAccessToken() == null || user.getSpotifyAccessToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Contul Spotify nu este legat. Apasă mai întâi pe „Link Spotify”.");
        }

        // 1. Tragem redările recente de la Spotify.
        List<SpotifyPlay> plays = fetchRecentlyPlayed(user.getSpotifyAccessToken());
        if (plays.isEmpty()) {
            return summary(0, 0, 0, "Spotify nu a returnat redări recente.");
        }

        // 2. Construim structura de date pentru căutare rapidă (nume_piesă_normalizat -> liste de timestamp-uri)
        Map<String, List<OffsetDateTime>> existingPlaysByTrack = loadExistingPlaysGrouped(userId);

        // 3. Inserăm doar ce nu există.
        int added = 0;
        int duplicates = 0;
        for (SpotifyPlay p : plays) {
            if (isDuplicatePlay(p, existingPlaysByTrack)) {
                duplicates++;
                continue;
            }

            // refolosim logica existentă de găsire/creare a piesei
            Track track = trackService.findOrCreateTrack(
                    p.trackUri(), p.trackName(), p.artistName(), p.albumName());

            ListeningRecord rec = new ListeningRecord();
            rec.setUser(user);
            rec.setTrack(track);
            rec.setPlayedAt(p.playedAt());
            rec.setMsPlayed(p.msPlayed());
            rec.setSource(ListeningSource.SPOTIFY);
            rec.setSkipped(false);
            listeningRecordRepository.save(rec);

            // adăugăm play-ul curent în structura de dedup ca să prindem și eventuale duplicate în același batch
            String normName = p.trackName() == null ? "" : p.trackName().trim().toLowerCase();
            existingPlaysByTrack.computeIfAbsent(normName, k -> new ArrayList<>()).add(p.playedAt());
            added++;
        }

        // 4. Trigger auto-refresh to Data Warehouse if new tracks were added to OLTP
        if (added > 0) {
            try {
                analyticsRefreshService.refreshWarehouseForUser(userId, 10000);
            } catch (Exception e) {
                // Log and continue - sync is still successful in OLTP
            }
        }

        return summary(plays.size(), duplicates, added,
                added > 0
                    ? added + " redări noi adăugate din Spotify și sincronizate în Data Warehouse."
                    : "Totul era deja sincronizat — nicio redare nouă.");
    }

    private Map<String, List<OffsetDateTime>> loadExistingPlaysGrouped(Long userId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT t.track_name AS track_name, lr.played_at AS played_at
                FROM oltp.listening_records lr
                JOIN oltp.tracks t ON lr.track_id = t.id
                WHERE lr.user_id = ?
                """, userId);

        Map<String, List<OffsetDateTime>> grouped = new HashMap<>();
        for (Map<String, Object> r : rows) {
            String name = (String) r.get("track_name");
            Object playedAt = r.get("played_at");
            OffsetDateTime odt = toOffset(playedAt);
            if (name != null && odt != null) {
                String normName = name.trim().toLowerCase();
                grouped.computeIfAbsent(normName, k -> new ArrayList<>()).add(odt);
            }
        }
        return grouped;
    }

    private boolean isDuplicatePlay(SpotifyPlay p, Map<String, List<OffsetDateTime>> existingPlays) {
        String normName = p.trackName() == null ? "" : p.trackName().trim().toLowerCase();
        List<OffsetDateTime> times = existingPlays.get(normName);
        if (times == null) {
            return false;
        }
        OffsetDateTime spotifyTime = p.playedAt();
        for (OffsetDateTime t : times) {
            // Dacă diferența absolută este mai mică de 90 de secunde (pentru a tolera trunchierea la minut din ZIP-uri)
            long diffSec = Math.abs(t.toEpochSecond() - spotifyTime.toEpochSecond());
            if (diffSec <= 90) {
                return true;
            }
        }
        return false;
    }

    private OffsetDateTime toOffset(Object dbValue) {
        if (dbValue == null) return null;
        if (dbValue instanceof OffsetDateTime odt) return odt;
        if (dbValue instanceof java.sql.Timestamp ts) {
            return ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
        }
        try {
            return OffsetDateTime.parse(dbValue.toString());
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<SpotifyPlay> fetchRecentlyPlayed(String accessToken) {
        String url = "https://api.spotify.com/v1/me/player/recently-played?limit=50";

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<Map> response;
        try {
            response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Nu am putut contacta Spotify. Tokenul poate fi expirat — reconectează Spotify.");
        }

        Map<String, Object> body = response.getBody();
        if (body == null || !body.containsKey("items")) return List.of();

        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        List<SpotifyPlay> plays = new ArrayList<>();

        for (Map<String, Object> item : items) {
            try {
                String playedAtStr = (String) item.get("played_at");
                OffsetDateTime playedAt = OffsetDateTime.parse(playedAtStr);

                Map<String, Object> track = (Map<String, Object>) item.get("track");
                String trackName = (String) track.get("name");
                String trackUri = (String) track.get("uri");
                Long durationMs = track.get("duration_ms") != null
                        ? ((Number) track.get("duration_ms")).longValue() : null;

                List<Map<String, Object>> artists = (List<Map<String, Object>>) track.get("artists");
                String artistName = (artists != null && !artists.isEmpty())
                        ? (String) artists.get(0).get("name") : null;

                Map<String, Object> album = (Map<String, Object>) track.get("album");
                String albumName = album != null ? (String) album.get("name") : null;

                plays.add(new SpotifyPlay(
                        trackName, artistName, albumName, trackUri, playedAt, durationMs));
            } catch (Exception ignore) {
            }
        }
        return plays;
    }

    private Map<String, Object> summary(int fetched, int duplicates, int added, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fetchedFromSpotify", fetched);
        m.put("alreadyExisted", duplicates);
        m.put("added", added);
        m.put("message", message);
        return m;
    }

    private record SpotifyPlay(
            String trackName,
            String artistName,
            String albumName,
            String trackUri,
            OffsetDateTime playedAt,
            Long msPlayed
    ) {}
}
