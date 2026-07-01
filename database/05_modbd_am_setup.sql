-- =============================================================================
-- 05_modbd_am_setup.sql - De executat PE INSTANȚA AM (port 5432 / container sau host native)
-- =============================================================================

-- Pas 1: Activare extensie postgres_fdw
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Pas 2: Definire Foreign Server și Mapping Utilizator
-- NOTĂ: Pentru mediu Docker, host-ul este 'music-analytics-db-eu'
-- Pentru conexiuni din exteriorul Docker, se poate mapa pe localhost/127.0.0.1 și portul 5433
CREATE SERVER IF NOT EXISTS link_bd_eu
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (
        host 'music-analytics-db-eu',
        port '5432',
        dbname 'music_analytics_eu'
    );

-- User mapping pentru replicare trans-server securizată.
-- NOTĂ DE SIGURANȚĂ: În producție, parolele/secretele ar trebui gestionate prin variabile de mediu sau vault-uri dedicate.
CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER link_bd_eu
    OPTIONS (user 'postgres', password 'postgres');

-- Pas 3: Import schemă EU ca Foreign Tables în schemă dedicată de link
CREATE SCHEMA IF NOT EXISTS oltp_eu_link;

IMPORT FOREIGN SCHEMA oltp
    FROM SERVER link_bd_eu
    INTO oltp_eu_link;

-- Pas 4: Tabela locală America pentru fragmentare orizontală
CREATE TABLE IF NOT EXISTS oltp.listening_records_am (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    track_id BIGINT NOT NULL,
    played_at TIMESTAMP NOT NULL,
    ms_played BIGINT,
    region VARCHAR(2) DEFAULT 'AM' NOT NULL,
    CONSTRAINT chk_region_am CHECK (region NOT IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU'))
);

-- Pas 5: View-ul Global de Transparență Orizontală (UNION ALL)
CREATE OR REPLACE VIEW oltp.v_listening_records_global AS
SELECT id, user_id, track_id, played_at, ms_played, region
FROM oltp.listening_records_am
UNION ALL
SELECT id, user_id, track_id, played_at, ms_played, region
FROM oltp_eu_link.listening_records_eu;

-- Pas 6: Trigger de Sincronizare trans-server pentru replicarea genurilor muzicale (genres -> genres pe EU)
CREATE OR REPLACE FUNCTION oltp.fn_sync_genres_to_eu()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO oltp_eu_link.genres (id, name)
        VALUES (NEW.id, NEW.name);

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE oltp_eu_link.genres
        SET name = NEW.name,
            replicated_from_am = CURRENT_TIMESTAMP
        WHERE id = NEW.id;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM oltp_eu_link.genres WHERE id = OLD.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_genres_to_eu ON oltp.genres;

CREATE TRIGGER trg_sync_genres_to_eu
AFTER INSERT OR UPDATE OR DELETE ON oltp.genres
FOR EACH ROW EXECUTE FUNCTION oltp.fn_sync_genres_to_eu();

-- Pas 7: Trigger INSTEAD OF pe global view pentru rutare automată a datelor (Geo-Partitioning real)
CREATE OR REPLACE FUNCTION oltp.fn_insert_listening_records_global()
RETURNS TRIGGER AS $$
BEGIN
    -- Rutare bazată pe țara de conexiune a utilizatorului (GDPR compliant)
    IF NEW.region IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU') THEN
        -- Utilizator din Europa -> trimitem în nodul străin Europa (EU)
        INSERT INTO oltp_eu_link.listening_records_eu
            (user_id, track_id, played_at, ms_played, region)
        VALUES
            (NEW.user_id, NEW.track_id, NEW.played_at, NEW.ms_played, NEW.region);
    ELSE
        -- Utilizator din America/Alte țări -> stocăm local pe nodul America (AM)
        INSERT INTO oltp.listening_records_am
            (user_id, track_id, played_at, ms_played, region)
        VALUES
            (NEW.user_id, NEW.track_id, NEW.played_at, NEW.ms_played, NEW.region);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insert_listening_records_global ON oltp.v_listening_records_global;

CREATE TRIGGER trg_insert_listening_records_global
INSTEAD OF INSERT ON oltp.v_listening_records_global
FOR EACH ROW EXECUTE FUNCTION oltp.fn_insert_listening_records_global();
