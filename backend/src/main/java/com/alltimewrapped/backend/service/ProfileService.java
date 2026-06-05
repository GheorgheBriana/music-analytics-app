package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ProfileResponse;
import com.alltimewrapped.backend.dto.ProfileStats;
import com.alltimewrapped.backend.dto.ProfileUpdateRequest;
import com.alltimewrapped.backend.dto.PublicProfileResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * ProfileService
 * ----------------------------------------------------------------------------
 * Gestionează profilul utilizatorului DEMONSTRÂND fragmentarea verticală MODBD.
 *
 * Datele de profil sunt fizic separate în două fragmente verticale:
 *   - oltp.user_profile_data (PUBLIC):  bio, favorite_genre, avatar_url
 *   - oltp.user_profile_sec  (SENSIBIL): api_key, last_login_ip, last_login_at
 *
 * Aplicația NU atinge direct fragmentele la scriere. Lucrează prin view-ul de transparență
 * oltp.v_user_profile:
 *   - CITIRE:  SELECT din v_user_profile (JOIN-ul reasamblează fragmentele)
 *   - SCRIERE: UPDATE pe v_user_profile -> declanșează trigger-ul INSTEAD OF
 *              fn_update_v_user_profile, care rutează coloanele către fragmentul corect.
 *
 * PRIVACY: profilul PUBLIC (ce văd prietenii) e citit cu un SELECT care
 * selectează DOAR coloanele din fragmentul public — câmpurile sensibile nu
 * părăsesc niciodată serverul către alt user.
 */
@Service
public class ProfileService {

    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder;

    public ProfileService(JdbcTemplate jdbcTemplate, BCryptPasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    // =========================================================================
    // PROFIL PROPRIU — userul își vede tot, inclusiv fragmentul sensibil
    // =========================================================================
    @Transactional(readOnly = true)
    public ProfileResponse getOwnProfile(Long userId) {
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT user_id, username, email, role,
                       bio, favorite_genre, avatar_url,
                       api_key, last_login_ip, last_login_at
                FROM oltp.v_user_profile
                WHERE user_id = ?
                """, userId);

        Map<String, Object> userRow = jdbcTemplate.queryForMap("""
                SELECT password_hash, spotify_user_id FROM oltp.app_users WHERE id = ?
                """, userId);
        boolean isLocal = userRow.get("password_hash") != null;
        String spotifyUserId = (String) userRow.get("spotify_user_id");

        ProfileStats stats = computeStats(userId);

        return new ProfileResponse(
                ((Number) row.get("user_id")).longValue(),
                (String) row.get("username"),
                (String) row.get("email"),
                String.valueOf(row.get("role")),
                (String) row.get("bio"),
                (String) row.get("favorite_genre"),
                (String) row.get("avatar_url"),
                (String) row.get("last_login_ip"),
                row.get("last_login_at") != null ? row.get("last_login_at").toString() : null,
                isLocal,
                spotifyUserId,
                stats
        );
    }

    // =========================================================================
    // PROFIL PUBLIC — ce vede un ALT user (prieten). DOAR fragmentul public.
    // =========================================================================
    @Transactional(readOnly = true)
    public PublicProfileResponse getPublicProfile(Long targetUserId, Long viewerUserId) {
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT u.id          AS user_id,
                       u.username,
                       u.role,
                       d.bio,
                       d.favorite_genre,
                       d.avatar_url
                FROM oltp.app_users u
                LEFT JOIN oltp.user_profile_data d ON u.id = d.user_id
                WHERE u.id = ?
                """, targetUserId);

        boolean isFriend = areFriends(viewerUserId, targetUserId);
        ProfileStats stats = computeStats(targetUserId);

        return new PublicProfileResponse(
                ((Number) row.get("user_id")).longValue(),
                (String) row.get("username"),
                String.valueOf(row.get("role")),
                (String) row.get("bio"),
                (String) row.get("favorite_genre"),
                (String) row.get("avatar_url"),
                stats,
                isFriend
        );
    }

    // =========================================================================
    // ACTUALIZARE PROFIL — scriem prin view => trigger INSTEAD OF rutează fragmentele
    // =========================================================================
    @Transactional
    public ProfileResponse updateProfile(Long userId, ProfileUpdateRequest req) {
        // Căutăm întâi valorile sensibile curente (api_key, last_login_ip, last_login_at)
        // pentru a le re-trimite în UPDATE, evitând ștergerea lor (înlocuirea cu NULL) de către trigger.
        Map<String, Object> current = jdbcTemplate.queryForMap("""
                SELECT api_key, last_login_ip, last_login_at
                FROM oltp.v_user_profile 
                WHERE user_id = ?
                """, userId);

        jdbcTemplate.update("""
                UPDATE oltp.v_user_profile
                SET bio            = ?,
                    favorite_genre = ?,
                    avatar_url     = ?,
                    api_key        = ?,
                    last_login_ip  = ?,
                    last_login_at  = ?
                WHERE user_id = ?
                """,
                req.bio(),
                req.favoriteGenre(),
                req.avatarUrl(),
                current.get("api_key"),
                current.get("last_login_ip"),
                current.get("last_login_at"),
                userId
        );

        return getOwnProfile(userId);
    }

    // =========================================================================
    // STATISTICI REZUMAT (din DW) — afișate pe profil
    // =========================================================================
    private ProfileStats computeStats(Long userId) {
        Map<String, Object> agg = jdbcTemplate.queryForMap("""
                SELECT COUNT(f.fact_id)       AS total_plays,
                       MIN(d.year)            AS first_year,
                       MAX(d.year)            AS last_year
                FROM dw.dw_fact_listening_event f
                JOIN dw.dw_dim_date d ON f.date_key = d.date_key
                JOIN dw.dw_dim_user u ON f.user_key = u.user_key
                WHERE u.original_user_id = ?
                """, userId);

        long totalPlays = agg.get("total_plays") != null ? ((Number) agg.get("total_plays")).longValue() : 0;
        Integer firstYear = agg.get("first_year") != null ? ((Number) agg.get("first_year")).intValue() : null;
        Integer lastYear = agg.get("last_year") != null ? ((Number) agg.get("last_year")).intValue() : null;

        String topGenre = "—";
        List<Map<String, Object>> top = jdbcTemplate.queryForList("""
                SELECT genre_name
                FROM dw.mv_top_genres
                WHERE original_user_id = ?
                ORDER BY total_plays DESC
                LIMIT 1
                """, userId);
        if (!top.isEmpty()) {
            topGenre = (String) top.get(0).get("genre_name");
        }

        int years = (firstYear != null && lastYear != null) ? (lastYear - firstYear + 1) : 0;

        return new ProfileStats(
                totalPlays,
                topGenre,
                years,
                firstYear != null ? String.valueOf(firstYear) : null,
                lastYear != null ? String.valueOf(lastYear) : null
        );
    }

    // =========================================================================
    // MODIFICARE PAROLĂ — doar pentru conturile locale
    // =========================================================================
    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        Map<String, Object> userRow;
        try {
            userRow = jdbcTemplate.queryForMap("""
                    SELECT password_hash FROM oltp.app_users WHERE id = ?
                    """, userId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "User not found");
        }

        String passwordHash = (String) userRow.get("password_hash");
        if (passwordHash == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Social accounts (Spotify) do not have a local password to change.");
        }

        if (!passwordEncoder.matches(oldPassword, passwordHash)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Parola curentă este incorectă.");
        }

        String newHash = passwordEncoder.encode(newPassword);
        jdbcTemplate.update("""
                UPDATE oltp.app_users SET password_hash = ? WHERE id = ?
                """, newHash, userId);
    }

    // =========================================================================
    // HELPER — verifică prietenie acceptată (bidirecțional)
    // =========================================================================
    private boolean areFriends(Long a, Long b) {
        if (a == null || b == null || a.equals(b)) return false;
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM oltp.friendships
                WHERE status = 'ACCEPTED'
                  AND ((requester_id = ? AND addressee_id = ?)
                    OR (requester_id = ? AND addressee_id = ?))
                """, Integer.class, a, b, b, a);
        return count != null && count > 0;
    }
}
