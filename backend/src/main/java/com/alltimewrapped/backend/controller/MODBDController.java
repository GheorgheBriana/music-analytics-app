package com.alltimewrapped.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/modbd")
@RequiredArgsConstructor
public class MODBDController {

    private final JdbcTemplate jdbcTemplate;

    // ==========================================
    // SECTIUNEA 1 & 2: FRAGMENTARE VERTICALĂ
    // ==========================================

    // 1. Vizualizare profil global prin View (Transparență)
    @GetMapping("/profiles")
    public List<Map<String, Object>> getGlobalProfiles() {
        String sql = "SELECT * FROM oltp.v_user_profile ORDER BY user_id";
        return jdbcTemplate.queryForList(sql);
    }

    // 2. Vizualizare fragmente fizice separate (Fragmentare Verticală)
    @GetMapping("/profiles/fragments")
    public Map<String, List<Map<String, Object>>> getProfileFragments() {
        Map<String, List<Map<String, Object>>> fragments = new HashMap<>();
        
        String sqlSec = "SELECT * FROM oltp.user_profile_sec ORDER BY user_id";
        fragments.put("sec", jdbcTemplate.queryForList(sqlSec));
        
        String sqlData = "SELECT * FROM oltp.user_profile_data ORDER BY user_id";
        fragments.put("data", jdbcTemplate.queryForList(sqlData));
        
        return fragments;
    }

    // 3. UPDATE transparent prin View (activează trigger-ul INSTEAD OF cu suport Upsert)
    @PutMapping("/profiles/{userId}")
    public Map<String, Object> updateProfile(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> body
    ) {
        String sql = "UPDATE oltp.v_user_profile SET " +
                "bio = ?, " +
                "favorite_genre = ?, " +
                "api_key = ?, " +
                "last_login_ip = ?, " +
                "last_login_at = CURRENT_TIMESTAMP " +
                "WHERE user_id = ?";

        jdbcTemplate.update(sql,
                body.get("bio"),
                body.get("favorite_genre"),
                body.get("api_key"),
                body.get("last_login_ip"),
                userId
        );

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Profile updated successfully via INSTEAD OF trigger.");
        return response;
    }

    // ==========================================
    // SECȚIUNEA 3: REPLICARE MULTI-SERVER (Genres)
    // ==========================================

    // 4. Vizualizare tabele de metadate replicate (Sursă America vs Replică Europa prin FDW)
    @GetMapping("/genres")
    public Map<String, Object> getReplicatedGenres() {
        Map<String, Object> data = new HashMap<>();
        
        String sqlGenres = "SELECT * FROM oltp.genres ORDER BY id DESC LIMIT 5";
        data.put("genres", jdbcTemplate.queryForList(sqlGenres));
        
        try {
            // Citire din replica reală din Europa (prin FDW link)
            String sqlReplica = "SELECT * FROM oltp_eu_link.genres ORDER BY id DESC LIMIT 5";
            data.put("replica", jdbcTemplate.queryForList(sqlReplica));
            data.put("status", "success");
            data.put("message", "Europe Node is Online. Live replicated data is displayed via FDW link.");
        } catch (Exception e) {
            // Fallback pe replica locală din America
            String sqlReplicaLocal = "SELECT id, name, replicated_at as replicated_from_am FROM oltp.genres_replica ORDER BY id DESC LIMIT 5";
            data.put("replica", jdbcTemplate.queryForList(sqlReplicaLocal));
            data.put("status", "partial");
            data.put("message", "Europe Node is Offline (Fallback on local America replica: genres_replica).");
        }
        
        return data;
    }

    // 5. Inserare în tabela principală pentru a demonstra replicarea trans-server (AFTER trigger)
    @PostMapping("/genres")
    public Map<String, Object> createGenre(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String sql = "INSERT INTO oltp.genres (name) VALUES (?)";
        jdbcTemplate.update(sql, name);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Genre created and replicated automatically trans-server.");
        return response;
    }

    // 6. Ștergere pentru a demonstra propagarea ștergerii (AFTER trigger)
    // Asigurăm tranzacționalitate atomică pentru a menține consistența ambelor fragmente de date
    @DeleteMapping("/genres/{id}")
    @Transactional
    public Map<String, Object> deleteGenre(@PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        try {
            // Obținem numele genului pentru a ne asigura că este gen de test/demo (modbd- sau test-)
            String name = jdbcTemplate.queryForObject("SELECT name FROM oltp.genres WHERE id = ?", String.class, id);
            if (name != null && (name.startsWith("modbd-") || name.startsWith("test-"))) {
                // Ștergem mai întâi legăturile din track_genres pentru a preveni erori de foreign key în Postgres
                jdbcTemplate.update("DELETE FROM oltp.track_genres WHERE genre_id = ?", id);
                
                // Ștergem înregistrarea principală (AFTER trigger va propaga ștergerea pe nodul EU sau replica locală)
                String sql = "DELETE FROM oltp.genres WHERE id = ?";
                jdbcTemplate.update(sql, id);
                
                response.put("success", true);
                response.put("message", "Genre deleted and replication updated trans-server.");
            } else {
                response.put("success", false);
                response.put("message", "Only genres starting with 'modbd-' or 'test-' can be deleted for safety.");
            }
        } catch (Exception e) {
            org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            response.put("success", false);
            response.put("message", "Error deleting genre: " + e.getMessage());
        }
        return response;
    }

    // ==========================================
    // SECȚIUNEA 4: FRAGMENTARE ORIZONTALĂ
    // ==========================================

    // 7. Vizualizare înregistrări ascultări globale (Transparență Orizontală)
    @GetMapping("/distributed/listening-records")
    public Map<String, Object> getGlobalListeningRecords() {
        Map<String, Object> response = new HashMap<>();
        try {
            String sql = "SELECT * FROM oltp.v_listening_records_global ORDER BY played_at DESC LIMIT 15";
            response.put("records", jdbcTemplate.queryForList(sql));
            response.put("status", "success");
            response.put("message", "All database nodes are active. Fragments are unified via the global view (UNION ALL).");
        } catch (Exception e) {
            // Fallback: citește doar din nodul local (America)
            String sql = "SELECT * FROM oltp.listening_records_am ORDER BY played_at DESC LIMIT 15";
            response.put("records", jdbcTemplate.queryForList(sql));
            response.put("status", "partial");
            response.put("message", "Europe Database Node is Offline. Interrogating only the local America node (Resilience Fallback).");
        }
        return response;
    }

    // 8. Vizualizare fragmente fizice orizontale separate (America vs Europe)
    @GetMapping("/distributed/listening-records/fragments")
    public Map<String, Object> getHorizontalFragments() {
        Map<String, Object> response = new HashMap<>();
        
        List<Map<String, Object>> amList = List.of();
        try {
            String sqlAm = "SELECT * FROM oltp.listening_records_am ORDER BY played_at DESC LIMIT 10";
            amList = jdbcTemplate.queryForList(sqlAm);
        } catch (Exception e) {
            // Ignorăm sau înregistrăm eroare
        }
        response.put("am", amList);

        try {
            String sqlEu = "SELECT * FROM oltp_eu_link.listening_records_eu ORDER BY played_at DESC LIMIT 10";
            response.put("eu", jdbcTemplate.queryForList(sqlEu));
            response.put("status", "success");
            response.put("message", "Horizontal partitions have been loaded. AM (local) and EU (foreign FDW) are connected.");
        } catch (Exception e) {
            response.put("eu", List.of());
            response.put("status", "partial");
            response.put("message", "Europe Database Node is Offline. The horizontal fragment from Europe cannot be queried.");
        }
        
        return response;
    }

    // 9. Inserare transparentă în view (rutare automată prin trigger-ul INSTEAD OF)
    @PostMapping("/distributed/listening-records")
    public Map<String, Object> createListeningRecord(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Long trackId = Long.valueOf(body.get("trackId").toString());
        Long msPlayed = Long.valueOf(body.get("msPlayed").toString());
        String region = body.getOrDefault("region", "RO").toString();

        String sql = "INSERT INTO oltp.v_listening_records_global (user_id, track_id, played_at, ms_played, region) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)";
        jdbcTemplate.update(sql, userId, trackId, msPlayed, region);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Record routed transparently based on region: " + region);
        return response;
    }

    // ==========================================
    // SECTIUNEA 5: VALIDARE INTEGRITATE ȘI SEED
    // ==========================================

    @GetMapping("/validation")
    public Map<String, Object> getValidation() {
        Map<String, Object> result = new HashMap<>();

        // 1. Starea nodului Europa
        boolean europeOnline = false;
        try {
            jdbcTemplate.queryForObject("SELECT 1 FROM oltp_eu_link.genres LIMIT 1", Integer.class);
            europeOnline = true;
        } catch (Exception e) {
            // Offline or link error
        }
        result.put("europeNodeOnline", europeOnline);

        // 2. Fragmentare verticală completă
        int totalUsers = 0;
        int secCount = 0;
        int dataCount = 0;
        int missingVertical = 0;
        try {
            totalUsers = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.app_users", Integer.class);
            secCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.user_profile_sec", Integer.class);
            dataCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.user_profile_data", Integer.class);
            String sqlVertical = "SELECT COUNT(*) FROM oltp.app_users WHERE id NOT IN (SELECT user_id FROM oltp.user_profile_sec) OR id NOT IN (SELECT user_id FROM oltp.user_profile_data)";
            missingVertical = jdbcTemplate.queryForObject(sqlVertical, Integer.class);
        } catch (Exception e) {
            // Handle error
        }

        Map<String, Object> vertical = new HashMap<>();
        vertical.put("status", missingVertical == 0 ? "PASS" : "FAIL");
        vertical.put("totalUsers", totalUsers);
        vertical.put("secCount", secCount);
        vertical.put("dataCount", dataCount);
        vertical.put("missingCount", missingVertical);
        result.put("verticalCompleteness", vertical);

        // 3. Reconstrucție orizontală corectă (prin view-ul global)
        Map<String, Object> reconstruction = new HashMap<>();
        if (europeOnline) {
            try {
                int amCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.listening_records_am", Integer.class);
                int euCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp_eu_link.listening_records_eu", Integer.class);
                int globalCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.v_listening_records_global", Integer.class);
                reconstruction.put("status", (globalCount == amCount + euCount) ? "PASS" : "FAIL");
                reconstruction.put("amCount", amCount);
                reconstruction.put("euCount", euCount);
                reconstruction.put("globalCount", globalCount);
            } catch (Exception e) {
                reconstruction.put("status", "FAIL");
            }
        } else {
            try {
                int amCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM oltp.listening_records_am", Integer.class);
                reconstruction.put("status", "UNAVAILABLE");
                reconstruction.put("amCount", amCount);
                reconstruction.put("euCount", -1);
                reconstruction.put("globalCount", -1);
            } catch (Exception e) {
                reconstruction.put("status", "FAIL");
            }
        }
        result.put("horizontalReconstruction", reconstruction);

        // 4. Disjuncția fragmentelor
        Map<String, Object> disjunction = new HashMap<>();
        if (europeOnline) {
            try {
                String sqlDisjunction = "SELECT COUNT(*) FROM oltp.listening_records_am am " +
                        "JOIN oltp_eu_link.listening_records_eu eu ON " +
                        "am.user_id = eu.user_id AND am.track_id = eu.track_id AND am.played_at = eu.played_at AND am.ms_played = eu.ms_played";
                int overlapCount = jdbcTemplate.queryForObject(sqlDisjunction, Integer.class);
                disjunction.put("status", overlapCount == 0 ? "PASS" : "FAIL");
                disjunction.put("overlapCount", overlapCount);
            } catch (Exception e) {
                disjunction.put("status", "FAIL");
            }
        } else {
            disjunction.put("status", "UNAVAILABLE");
            disjunction.put("overlapCount", -1);
        }
        result.put("horizontalDisjunction", disjunction);

        // 5. Regiuni corect rutate
        Map<String, Object> routing = new HashMap<>();
        try {
            String sqlInvalidAm = "SELECT COUNT(*) FROM oltp.listening_records_am WHERE region IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU')";
            int invalidAmCount = jdbcTemplate.queryForObject(sqlInvalidAm, Integer.class);
            routing.put("invalidAmCount", invalidAmCount);

            if (europeOnline) {
                String sqlInvalidEu = "SELECT COUNT(*) FROM oltp_eu_link.listening_records_eu WHERE region NOT IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU')";
                int invalidEuCount = jdbcTemplate.queryForObject(sqlInvalidEu, Integer.class);
                routing.put("invalidEuCount", invalidEuCount);
                routing.put("status", (invalidAmCount == 0 && invalidEuCount == 0) ? "PASS" : "FAIL");
            } else {
                routing.put("invalidEuCount", -1);
                routing.put("status", invalidAmCount == 0 ? "PASS" : "FAIL");
            }
        } catch (Exception e) {
            routing.put("status", "FAIL");
        }
        result.put("regionRouting", routing);

        // 6. Consistența replicii genurilor (locală de fallback și remote Europa)
        Map<String, Object> genresRep = new HashMap<>();
        try {
            String sqlLocalDiff1 = "SELECT COUNT(*) FROM (SELECT id, name FROM oltp.genres EXCEPT SELECT id, name FROM oltp.genres_replica) AS diff";
            String sqlLocalDiff2 = "SELECT COUNT(*) FROM (SELECT id, name FROM oltp.genres_replica EXCEPT SELECT id, name FROM oltp.genres) AS diff";
            int localDiffCount = jdbcTemplate.queryForObject(sqlLocalDiff1, Integer.class) + jdbcTemplate.queryForObject(sqlLocalDiff2, Integer.class);
            genresRep.put("localDiffCount", localDiffCount);

            if (europeOnline) {
                String sqlRemoteDiff1 = "SELECT COUNT(*) FROM (SELECT id, name FROM oltp.genres EXCEPT SELECT id, name FROM oltp_eu_link.genres) AS diff";
                String sqlRemoteDiff2 = "SELECT COUNT(*) FROM (SELECT id, name FROM oltp_eu_link.genres EXCEPT SELECT id, name FROM oltp.genres) AS diff";
                int remoteDiffCount = jdbcTemplate.queryForObject(sqlRemoteDiff1, Integer.class) + jdbcTemplate.queryForObject(sqlRemoteDiff2, Integer.class);
                genresRep.put("remoteDiffCount", remoteDiffCount);
                genresRep.put("status", (localDiffCount == 0 && remoteDiffCount == 0) ? "PASS" : "FAIL");
            } else {
                genresRep.put("remoteDiffCount", -1);
                genresRep.put("status", localDiffCount == 0 ? "PASS" : "FAIL");
            }
        } catch (Exception e) {
            genresRep.put("status", "FAIL");
        }
        result.put("genreReplication", genresRep);

        return result;
    }

    @PostMapping("/genres/sync")
    @Transactional
    public Map<String, Object> syncGenres() {
        Map<String, Object> response = new HashMap<>();
        boolean localSuccess = false;
        boolean remoteSuccess = false;
        String message = "";

        try {
            // Sincronizare locală genres_replica (upsert)
            jdbcTemplate.update("INSERT INTO oltp.genres_replica (id, name) " +
                    "SELECT id, name FROM oltp.genres " +
                    "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name");
            // Ștergere genuri orfane (local)
            jdbcTemplate.update("DELETE FROM oltp.genres_replica WHERE id NOT IN (SELECT id FROM oltp.genres)");
            localSuccess = true;
            message += "Replică locală de fallback sincronizată. ";
        } catch (Exception e) {
            message += "Eroare replică locală: " + e.getMessage() + ". ";
        }

        // Sincronizare remote (EU)
        boolean europeOnline = false;
        try {
            jdbcTemplate.queryForObject("SELECT 1 FROM oltp_eu_link.genres LIMIT 1", Integer.class);
            europeOnline = true;
        } catch (Exception e) {
            // Offline
        }

        if (europeOnline) {
            try {
                // Sincronizare remote Europa (UPDATE pentru înregistrările modificate)
                jdbcTemplate.update("UPDATE oltp_eu_link.genres target " +
                        "SET name = source.name, " +
                        "    replicated_from_am = CURRENT_TIMESTAMP " +
                        "FROM oltp.genres source " +
                        "WHERE target.id = source.id AND target.name <> source.name");

                // Sincronizare remote Europa (INSERT pentru înregistrările noi)
                jdbcTemplate.update("INSERT INTO oltp_eu_link.genres (id, name) " +
                        "SELECT source.id, source.name FROM oltp.genres source " +
                        "WHERE source.id NOT IN (SELECT id FROM oltp_eu_link.genres)");

                // Ștergere genuri orfane (Europa)
                jdbcTemplate.update("DELETE FROM oltp_eu_link.genres WHERE id NOT IN (SELECT id FROM oltp.genres)");
                remoteSuccess = true;
                message += "Replica Europa sincronizată.";
            } catch (Exception e) {
                message += "Eroare replica Europa: " + e.getMessage() + ".";
            }
        } else {
            message += "Nodul Europa este Offline, s-a omis sincronizarea remote.";
        }

        response.put("success", localSuccess);
        response.put("europeOnline", europeOnline);
        response.put("remoteSuccess", remoteSuccess);
        response.put("message", message);
        return response;
    }
}
