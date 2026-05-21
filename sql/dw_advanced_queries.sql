-- =============================================================================
-- CERERI AVANSATE DW: ROLLUP, GROUPING SETS, CUBE
-- Demonstrează agregări ierarhice specifice depozitelor de date.
-- Aceste cereri exploatează schema stea (fact + dimensiuni) și partiționarea
-- pentru a produce rapoarte multi-nivel fără query-uri separate.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CEREREA 1: ROLLUP pe ierarhia An → Lună → Gen muzical
-- Produce subtotaluri la fiecare nivel al ierarhiei:
--   (an, lună, gen) → rândul detaliat
--   (an, lună, NULL) → subtotal pe lună
--   (an, NULL, NULL) → subtotal pe an
--   (NULL, NULL, NULL) → total general
-- Coloana GROUPING() = 1 când valoarea este un subtotal (NULL sintetizat de ROLLUP)
-- -----------------------------------------------------------------------------
EXPLAIN ANALYZE
SELECT
    d.year                                              AS year,
    d.month                                             AS month,
    d.month_name                                        AS month_name,
    g.genre_name                                        AS genre_name,
    COUNT(f.fact_id)                                    AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes,
    GROUPING(d.year)                                    AS is_year_subtotal,
    GROUPING(d.month)                                   AS is_month_subtotal,
    GROUPING(g.genre_name)                              AS is_genre_subtotal
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
WHERE u.original_user_id = 2                            -- înlocuiește cu userId real
GROUP BY ROLLUP(d.year, (d.month, d.month_name), g.genre_name)
ORDER BY
    d.year      NULLS LAST,
    d.month     NULLS LAST,
    g.genre_name NULLS LAST;

-- Interpretare rezultate:
-- is_year_subtotal=0, is_month_subtotal=0, is_genre_subtotal=0 → rând detaliat
-- is_genre_subtotal=1 → total redări per (an, lună), indiferent de gen
-- is_month_subtotal=1 → total redări per an, indiferent de lună
-- is_year_subtotal=1  → GRAND TOTAL (toate înregistrările)


-- -----------------------------------------------------------------------------
-- CEREREA 2: GROUPING SETS — agregare selectivă
-- Produce doar combinațiile utile, fără toate nivelurile intermediare ale ROLLUP.
-- Util când vrei (an, gen) și (lună, gen) dar nu neapărat (an, lună, gen).
-- -----------------------------------------------------------------------------
SELECT
    d.year                                              AS year,
    d.month_name                                        AS month_name,
    g.genre_name                                        AS genre_name,
    COUNT(f.fact_id)                                    AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date  d ON f.date_key  = d.date_key
JOIN dw.dw_dim_genre g ON f.genre_key = g.genre_key
JOIN dw.dw_dim_user  u ON f.user_key  = u.user_key
WHERE u.original_user_id = 2
GROUP BY GROUPING SETS (
    (d.year, g.genre_name),          -- total per an + gen
    (d.month_name, g.genre_name),    -- total per lună + gen
    (g.genre_name),                  -- total general per gen
    ()                               -- grand total
)
ORDER BY d.year NULLS LAST, d.month_name NULLS LAST, g.genre_name NULLS LAST;


-- -----------------------------------------------------------------------------
-- CEREREA 3: ROLLUP pe Platform → An → Lună
-- Demonstrează o altă ierarhie: de unde asculți (platformă) vs când asculți.
-- Util pentru raportul "Platform Usage Evolution".
-- -----------------------------------------------------------------------------
SELECT
    p.platform_name                                     AS platform_name,
    d.year                                              AS year,
    d.month_name                                        AS month_name,
    COUNT(f.fact_id)                                    AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes,
    GROUPING(p.platform_name)                           AS is_platform_subtotal,
    GROUPING(d.year)                                    AS is_year_subtotal
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_platform p ON f.platform_key = p.platform_key
JOIN dw.dw_dim_date     d ON f.date_key     = d.date_key
JOIN dw.dw_dim_user     u ON f.user_key     = u.user_key
WHERE u.original_user_id = 2
GROUP BY ROLLUP(p.platform_name, d.year, d.month_name)
ORDER BY p.platform_name NULLS LAST, d.year NULLS LAST, d.month_name NULLS LAST;
