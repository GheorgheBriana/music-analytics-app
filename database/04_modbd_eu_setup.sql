-- =============================================================================
-- 04_modbd_eu_setup.sql - De executat PE INSTANȚA EU (port 5433 / container music-analytics-db-eu)
-- =============================================================================

-- Pas 1: Creare schemă locală
CREATE SCHEMA IF NOT EXISTS oltp;

-- Pas 2: Tabela de genuri muzicale replici
CREATE TABLE IF NOT EXISTS oltp.genres (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    replicated_from_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pas 3: Tabela locală de ascultări (fragment orizontal pentru Europa)
CREATE TABLE IF NOT EXISTS oltp.listening_records_eu (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    track_id BIGINT NOT NULL,
    played_at TIMESTAMP NOT NULL,
    ms_played BIGINT,
    region VARCHAR(2) DEFAULT 'EU' NOT NULL,
    CONSTRAINT chk_region_eu CHECK (region IN ('RO', 'DE', 'FR', 'ES', 'IT', 'UK', 'EU'))
);
