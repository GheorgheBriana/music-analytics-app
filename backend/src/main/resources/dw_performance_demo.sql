-- =========================================================================================
-- DEMONSTRAȚIE DE PERFORMANȚĂ: FACT TABLE vs MATERIALIZED VIEW
-- Acest script demonstrează eficiența Materialized Views și partiționării în PostgreSQL.
-- Executați întregul script pentru a observa diferența de costuri și timp de execuție.
-- =========================================================================================

-- 1. Asigurăm forțarea planului real pentru o evaluare curată
SET random_page_cost = 1.1;
SET enable_seqscan = ON;

-- =========================================================================================
-- SCENARIUL 1: Interogare complexă direct pe Tabela de Fapte (Fact Table)
-- Aici se va executa o agregare completă a datelor (total_plays, total_minutes) 
-- pe baza dimensiunilor de dată și timp, cu funcții de grup și JOIN-uri mari.
-- Observați că query-ul citește peste tot (sau prin partiții) și face sortare în memorie.
-- =========================================================================================
EXPLAIN ANALYZE
SELECT
    d.day_of_week AS day_of_week,
    d.day_name AS day_name,
    t.hour AS hour,
    COUNT(f.fact_id) AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
WHERE d.year = 2024 OR d.year = 2025 -- Folosim filtrare pe partiții (Partition Pruning)
GROUP BY d.day_of_week, d.day_name, t.hour
ORDER BY d.day_of_week, t.hour;

-- =========================================================================================
-- SCENARIUL 2: Interogare identică, dar apelată de pe Materialized View
-- Materialized View-ul are deja rezultatul pre-calculat al JOIN-urilor și agregărilor.
-- Aici, planul de execuție va arăta doar un "Seq Scan" simplu (sau Index Scan) pe un set 
-- de date extrem de mic (ex: 168 de rânduri pentru fiecare oră a săptămânii).
-- Costul și timpul de execuție sunt fracțiuni infime comparativ cu Scenariul 1.
-- =========================================================================================
EXPLAIN ANALYZE
SELECT
    day_of_week,
    day_name,
    hour,
    total_plays,
    total_minutes
FROM dw.mv_listening_heatmap
ORDER BY day_of_week, hour;

-- =========================================================================================
-- SCENARIUL 3: Demonstrație de Partiționare (Partition Pruning)
-- Aici filtrăm doar o singură lună. Query Planner-ul va căuta exclusiv în partiția aferentă
-- ex: dw.dw_fact_listening_event_2024_03, ignorând complet restul datelor din istoric.
-- =========================================================================================
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM dw.dw_fact_listening_event
WHERE date_key BETWEEN 20240301 AND 20240331;
