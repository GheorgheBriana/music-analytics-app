-- =============================================================================
-- 08_modbd_demo.sql - Demonstrație MODBD (Single-Instance PostgreSQL)
-- =============================================================================

-- SECȚIUNEA 1: FRAGMENTARE VERTICALĂ
-- Despărțim profilul utilizatorului în două tabele fizice separate pe baza coloanelor.
CREATE TABLE IF NOT EXISTS oltp.user_profile_sec (
    user_id        BIGINT PRIMARY KEY REFERENCES oltp.app_users(id) ON DELETE CASCADE,
    api_key        VARCHAR(255),
    last_login_ip  VARCHAR(45),
    last_login_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oltp.user_profile_data (
    user_id         BIGINT PRIMARY KEY REFERENCES oltp.app_users(id) ON DELETE CASCADE,
    bio             TEXT,
    favorite_genre  VARCHAR(100),
    avatar_url      VARCHAR(500)
);

-- Populare inițială a fragmentelor pentru utilizatorii existenți
INSERT INTO oltp.user_profile_sec (user_id)
SELECT id FROM oltp.app_users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO oltp.user_profile_data (user_id)
SELECT id FROM oltp.app_users
ON CONFLICT (user_id) DO NOTHING;


-- SECȚIUNEA 2: VIEW DE TRANSPARENȚĂ
-- Reasamblăm fragmentele verticale prin JOIN pentru a oferi o entitate logică unificată.
CREATE OR REPLACE VIEW oltp.v_user_profile AS
SELECT
    u.id            AS user_id,
    u.username,
    u.email,
    u.role,
    s.api_key,
    s.last_login_ip,
    s.last_login_at,
    d.bio,
    d.favorite_genre,
    d.avatar_url
FROM oltp.app_users u
LEFT JOIN oltp.user_profile_sec  s ON u.id = s.user_id
LEFT JOIN oltp.user_profile_data d ON u.id = d.user_id;


-- SECȚIUNEA 3: INSTEAD OF TRIGGER PENTRU ACTUALIZARE TRANSPARENTĂ
-- Interceptăm modificările pe view-ul logic și le rutăm către fragmentele fizice corecte.
CREATE OR REPLACE FUNCTION oltp.fn_update_v_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or Insert for Secure Fragment
    INSERT INTO oltp.user_profile_sec (user_id, api_key, last_login_ip, last_login_at)
    VALUES (OLD.user_id, NEW.api_key, NEW.last_login_ip, NEW.last_login_at)
    ON CONFLICT (user_id) DO UPDATE
    SET api_key       = EXCLUDED.api_key,
        last_login_ip = EXCLUDED.last_login_ip,
        last_login_at = EXCLUDED.last_login_at;

    -- Update or Insert for Public Fragment
    INSERT INTO oltp.user_profile_data (user_id, bio, favorite_genre, avatar_url)
    VALUES (OLD.user_id, NEW.bio, NEW.favorite_genre, NEW.avatar_url)
    ON CONFLICT (user_id) DO UPDATE
    SET bio            = EXCLUDED.bio,
        favorite_genre = EXCLUDED.favorite_genre,
        avatar_url     = EXCLUDED.avatar_url;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_v_user_profile ON oltp.v_user_profile;

CREATE TRIGGER trg_update_v_user_profile
INSTEAD OF UPDATE ON oltp.v_user_profile
FOR EACH ROW EXECUTE FUNCTION oltp.fn_update_v_user_profile();


-- SECȚIUNEA 4: REPLICARE + SINCRONIZARE PRIN TRIGGER
-- Propagăm modificările de pe tabela primară genres către tabela genres_replica.
CREATE TABLE IF NOT EXISTS oltp.genres_replica (
    id             BIGINT PRIMARY KEY,
    name           VARCHAR(100),
    replicated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copiere inițială a stării curente în replică
INSERT INTO oltp.genres_replica (id, name)
SELECT id, name FROM oltp.genres
ON CONFLICT (id) DO NOTHING;

-- Funcție trigger pentru propagarea automată
CREATE OR REPLACE FUNCTION oltp.fn_sync_genres_replica()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO oltp.genres_replica (id, name)
        VALUES (NEW.id, NEW.name)
        ON CONFLICT (id) DO NOTHING;

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE oltp.genres_replica
        SET name = NEW.name,
            replicated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM oltp.genres_replica WHERE id = OLD.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_genres_replica ON oltp.genres;

CREATE TRIGGER trg_sync_genres_replica
AFTER INSERT OR UPDATE OR DELETE ON oltp.genres
FOR EACH ROW EXECUTE FUNCTION oltp.fn_sync_genres_replica();


-- SECȚIUNEA 5: TESTE DE VALIDARE
-- Rulați comenzile de mai jos secvențial pentru a verifica comportamentul.

-- TEST 1: Sincronizare la INSERT în genres
-- INSERT INTO oltp.genres (name) VALUES ('modbd-test-genre');
-- SELECT id, name, replicated_at FROM oltp.genres_replica WHERE name = 'modbd-test-genre';

-- TEST 2: Sincronizare la UPDATE în genres
-- UPDATE oltp.genres SET name = 'modbd-test-updated' WHERE name = 'modbd-test-genre';
-- SELECT id, name, replicated_at FROM oltp.genres_replica WHERE name LIKE 'modbd-test%';

-- TEST 3: Sincronizare la DELETE în genres
-- DELETE FROM oltp.genres WHERE name = 'modbd-test-updated';
-- SELECT * FROM oltp.genres_replica WHERE name LIKE 'modbd-test%';

-- TEST 4: Vizualizare date din fragmentele fizice
-- SELECT 'sec' AS fragment, user_id, api_key, last_login_ip FROM oltp.user_profile_sec
-- UNION ALL
-- SELECT 'data' AS fragment, user_id, bio, favorite_genre FROM oltp.user_profile_data LIMIT 10;

-- TEST 5: Vizualizare date reasamblate prin view-ul de transparență
-- SELECT user_id, username, api_key, bio, favorite_genre FROM oltp.v_user_profile LIMIT 5;

-- TEST 6: UPDATE transparent pe view-ul logic (rutează automat în ambele fragmente)
-- UPDATE oltp.v_user_profile
-- SET bio = 'Demonstratie INSTEAD OF trigger MODBD',
--     favorite_genre = 'electronic',
--     api_key = 'test-api-key-modbd',
--     last_login_ip = '127.0.0.1',
--     last_login_at = CURRENT_TIMESTAMP
-- WHERE user_id = 1; -- <-- Înlocuiește cu un ID valid de utilizator

-- SELECT 'sec' AS fragment, user_id, api_key, last_login_ip, last_login_at::TEXT FROM oltp.user_profile_sec WHERE user_id = 1
-- UNION ALL
-- SELECT 'data' AS fragment, user_id, bio, favorite_genre, '' FROM oltp.user_profile_data WHERE user_id = 1;


-- SECȚIUNEA 6: MONITORIZARE STATUS
SELECT 'user_profile_sec' AS obiect, COUNT(*) AS randuri FROM oltp.user_profile_sec
UNION ALL
SELECT 'user_profile_data',          COUNT(*)          FROM oltp.user_profile_data
UNION ALL
SELECT 'genres',                     COUNT(*)          FROM oltp.genres
UNION ALL
SELECT 'genres_replica',             COUNT(*)          FROM oltp.genres_replica;
