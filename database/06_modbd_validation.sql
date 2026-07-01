-- =============================================================================
-- 06_modbd_validation.sql - Validare Integritate și Trigger Utilizatori Noi
-- =============================================================================

-- Pas 1: Trigger AFTER INSERT pe oltp.app_users
-- Asigură completitudinea fragmentării verticale pentru utilizatorii adăugați ulterior
CREATE OR REPLACE FUNCTION oltp.fn_create_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO oltp.user_profile_sec (user_id) 
    VALUES (NEW.id) 
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO oltp.user_profile_data (user_id) 
    VALUES (NEW.id) 
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_user_profiles ON oltp.app_users;

CREATE TRIGGER trg_create_user_profiles
AFTER INSERT ON oltp.app_users
FOR EACH ROW EXECUTE FUNCTION oltp.fn_create_user_profiles();


-- Pas 2: Interogări de seed complet pentru sincronizare Master-Replică
-- (Rulabile din codul backend la solicitarea utilizatorului)

-- A. Sincronizare Replică Locală (de fallback)
-- 1. Upsert (Insert/Update)
-- INSERT INTO oltp.genres_replica (id, name)
-- SELECT id, name FROM oltp.genres
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
-- 2. Deletions (Ștergere orfani)
-- DELETE FROM oltp.genres_replica WHERE id NOT IN (SELECT id FROM oltp.genres);

-- B. Sincronizare Replică Remote Europa (dacă nodul este online - FDW nu suportă ON CONFLICT)
-- 1. UPDATE pentru nume modificate
-- UPDATE oltp_eu_link.genres target SET name = source.name, replicated_from_am = CURRENT_TIMESTAMP FROM oltp.genres source WHERE target.id = source.id AND target.name <> source.name;
-- 2. INSERT pentru genuri noi
-- INSERT INTO oltp_eu_link.genres (id, name) SELECT source.id, source.name FROM oltp.genres source WHERE source.id NOT IN (SELECT id FROM oltp_eu_link.genres);
-- 3. Ștergere genuri orfane (deletions)
-- DELETE FROM oltp_eu_link.genres WHERE id NOT IN (SELECT id FROM oltp.genres);

-- C. Backfill pentru utilizatorii existenți fără fragmente verticale (Completitudine)
-- INSERT INTO oltp.user_profile_sec (user_id) SELECT id FROM oltp.app_users ON CONFLICT (user_id) DO NOTHING;
-- INSERT INTO oltp.user_profile_data (user_id) SELECT id FROM oltp.app_users ON CONFLICT (user_id) DO NOTHING;


-- Pas 3: Interogări de validare a corectitudinii fragmentării (pentru Anexă)

-- A. Completitudine Verticală (rânduri lipsă în fragmente)
-- SELECT COUNT(*) FROM oltp.app_users 
-- WHERE id NOT IN (SELECT user_id FROM oltp.user_profile_sec) 
--    OR id NOT IN (SELECT user_id FROM oltp.user_profile_data);

-- B. Verificarea reconstrucției transparente prin view-ul global
-- SELECT 
--   (SELECT COUNT(*) FROM oltp.v_listening_records_global) = 
--   ((SELECT COUNT(*) FROM oltp.listening_records_am) + (SELECT COUNT(*) FROM oltp_eu_link.listening_records_eu)) 
--   AS reconstructie_valida;

-- C. Disjuncția fragmentelor orizontale (absența suprapunerilor pe cheie logică)
-- SELECT COUNT(*) FROM oltp.listening_records_am am
-- JOIN oltp_eu_link.listening_records_eu eu ON 
--   am.user_id = eu.user_id AND 
--   am.track_id = eu.track_id AND 
--   am.played_at = eu.played_at AND 
--   am.ms_played = eu.ms_played;

-- D. Regiuni corect rutate
-- -- 1. În nodul local America nu trebuie să existe regiuni europene
-- SELECT COUNT(*) FROM oltp.listening_records_am 
-- WHERE region IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU');
-- -- 2. În nodul remote Europa nu trebuie să existe regiuni americane/non-europene
-- SELECT COUNT(*) FROM oltp_eu_link.listening_records_eu 
-- WHERE region NOT IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU');

-- E. Consistența replicii genurilor (locală de fallback și remote Europa)
-- -- 1. Diferența bidirecțională pentru replica locală de fallback
-- SELECT COUNT(*) FROM (
--     (SELECT id, name FROM oltp.genres EXCEPT SELECT id, name FROM oltp.genres_replica)
--     UNION ALL
--     (SELECT id, name FROM oltp.genres_replica EXCEPT SELECT id, name FROM oltp.genres)
-- ) AS local_diff;
-- -- 2. Diferența bidirecțională pentru replica remote din Europa
-- SELECT COUNT(*) FROM (
--     (SELECT id, name FROM oltp.genres EXCEPT SELECT id, name FROM oltp_eu_link.genres)
--     UNION ALL
--     (SELECT id, name FROM oltp_eu_link.genres EXCEPT SELECT id, name FROM oltp.genres)
-- ) AS remote_diff;
