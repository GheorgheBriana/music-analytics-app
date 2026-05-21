# DW Execution Plans — EXPLAIN ANALYZE Results
**Data Warehouse: All-Time Wrapped | PostgreSQL 18.3**

Acest document conține planurile de execuție reale obținute prin `EXPLAIN ANALYZE`
pentru trei scenarii reprezentative ale arhitecturii DW. Rezultatele demonstrează
impactul concret al deciziilor de design (Materialized Views, partiționare) asupra
timpilor de răspuns.

---

## Scenariu 1 — Interogare directă pe Fact Table

**Cerere:** Activitate per zi a săptămânii și oră, pentru anii 2024–2025, cu filtrare pe user.

```sql
EXPLAIN ANALYZE
SELECT
    d.day_of_week, d.day_name, t.hour,
    COUNT(f.fact_id)                                      AS total_plays,
    ROUND(COALESCE(SUM(f.minutes_played), 0)::numeric, 2) AS total_minutes
FROM dw.dw_fact_listening_event f
JOIN dw.dw_dim_date d ON f.date_key = d.date_key
JOIN dw.dw_dim_time t ON f.time_key = t.time_key
JOIN dw.dw_dim_user u ON f.user_key = u.user_key
WHERE u.original_user_id = 2
  AND (d.year = 2024 OR d.year = 2025)
GROUP BY d.day_of_week, d.day_name, t.hour
ORDER BY d.day_of_week, t.hour;
```

**Timp de execuție real: 48.853 ms**

```
GroupAggregate  (cost=728.63..730.46 rows=61 width=56)
                (actual time=45.468..48.412 rows=142 loops=1)
  Group Key: d.day_of_week, t.hour, d.day_name
  Buffers: shared hit=38986 read=15
  ->  Sort  (cost=728.63..728.78 rows=61 width=32)
            (actual time=45.419..45.888 rows=12882 loops=1)
        Sort Key: d.day_of_week, t.hour, d.day_name
        Sort Method: quicksort  Memory: 1033kB
        ->  Nested Loop  (cost=25.74..726.82 rows=61 width=32)
                         (actual time=0.984..38.985 rows=12882 loops=1)
              ->  Hash Join  (cost=25.46..708.62 rows=61 width=36)
                             (actual time=0.647..15.272 rows=12882 loops=1)
                    Hash Cond: (f.date_key = d.date_key)
                    ->  Hash Join  (cost=8.17..691.08 rows=95 width=32)
                                   (actual time=0.270..12.353 rows=12882 loops=1)
                          Hash Cond: (f.user_key = u.user_key)
                          ->  Append  (actual time=0.055..9.176 rows=18382 loops=1)
                                ->  Seq Scan on dw_fact_listening_event_2023
                                      (rows=0)           ← partiție goală
                                ->  Seq Scan on dw_fact_listening_event_2024
                                      (rows=4480)
                                ->  Seq Scan on dw_fact_listening_event_2025
                                      (rows=11870)
                                ->  Seq Scan on dw_fact_listening_event_default
                                      (rows=2032)
                          ->  Hash on dw_dim_user
                                Index Scan by uk_dw_dim_user_original_user_id
                                (rows=1)                 ← 1 user găsit rapid
                    ->  Hash on dw_dim_date
                          Seq Scan, Filter: year IN (2024, 2025)
                          Rows Removed by Filter: 132
              ->  Index Scan on dw_dim_time (loops=12882)
                    ← 12.882 lookup-uri individuale pe dimensiunea Time
Planning Time:  34.593 ms
Execution Time: 48.853 ms
```

### Observații asupra planului

**Nodul `Append`** — Hibernate a creat tabela `dw_fact_listening_event` ca tabel
partiționat. Întrucât filtrul `year` se aplică pe dimensiunea `dw_dim_date` (nu direct
pe `date_key`), optimizatorul nu poate face partition pruning la acest nivel și
scanează toate cele 4 partiții secvențial. Acest comportament demonstrează limita
filtrării indirecte prin JOIN vs. filtrare directă pe cheia de partiționare (vezi
Scenariul 3).

**Nodul `Hash Join`** — joins-urile dintre fact și dimensiunile `dw_dim_date`,
`dw_dim_user` se fac prin hash join, eficient pentru seturi medii. Costul de hash
build este vizibil: `Hash on dw_dim_date` construiește un hash din 359 de rânduri.

**Nodul `Nested Loop`** (12.882 iterații pe `dw_dim_time`) — fiecare fact row
necesită un index lookup individual pe dimensiunea Time. Acesta este cel mai costisitor
nod din plan și motivul principal pentru care MV-ul este superior (vezi Scenariul 2).

**Sortare în memorie (1033kB)** — datele agregate sunt sortate în memorie înainte de
`GroupAggregate`. La volume mai mari, sort-ul ar depăși `work_mem` și ar trece pe disc.

---

## Scenariu 2 — Aceeași interogare pe Materialized View

**Cerere:** Identică semantic cu Scenariul 1, dar executată pe `mv_listening_heatmap`
(view materializat pre-calculat la rularea pipeline-ului analytics).

```sql
EXPLAIN ANALYZE
SELECT day_of_week, day_name, hour, total_plays, total_minutes
FROM dw.mv_listening_heatmap
WHERE original_user_id = 2
ORDER BY day_of_week, hour;
```

**Timp de execuție real: 2.638 ms (de ~18.5× mai rapid)**

```
Sort  (cost=12.95..13.31 rows=142 width=30)
      (actual time=2.560..2.565 rows=142 loops=1)
  Sort Key: day_of_week, hour
  Sort Method: quicksort  Memory: 32kB
  Buffers: shared hit=3 read=4
  ->  Seq Scan on mv_listening_heatmap
        (cost=0.00..7.88 rows=142 width=30)
        (actual time=2.273..2.468 rows=142 loops=1)
        Filter: (original_user_id = 2)
        Rows Removed by Filter: 168
        Buffers: shared read=4
Planning Time:  2.253 ms
Execution Time: 2.638 ms
```

### Observații asupra planului

**Un singur `Seq Scan`** — MV-ul conține 310 rânduri pre-agregate (168 ale altor
useri + 142 ale userului 2). Nu există hash join, nested loop sau sort costisitor.
Întregul MV încape în 4 pagini de disc (`shared read=4`).

**Eliminarea join-urilor** — cele 3 join-uri față de `dw_dim_date`, `dw_dim_time`,
`dw_dim_user` și agregarea `COUNT/SUM` au fost executate o singură dată la
`REFRESH MATERIALIZED VIEW`. Fiecare apel ulterior reutilizează rezultatul.

**Comparație directă:**

| Metric              | Fact Table direct | Materialized View |
|---------------------|------------------:|------------------:|
| Execution Time      | 48.853 ms         | 2.638 ms          |
| Rows procesate      | 18.382            | 310               |
| Buffer pages read   | 15                | 4                 |
| Join-uri            | 3 Hash + 1 NL     | 0                 |
| Sort memory         | 1033 kB           | 32 kB             |
| **Speedup**         | —                 | **~18.5×**        |

**Limitare MV:** datele nu sunt live — reflectă starea la ultimul `REFRESH`.
În arhitectura curentă, refresh-ul este declanșat explicit prin pipeline (`POST /api/analytics/pipeline/rebuild`), ceea ce este acceptabil pentru date istorice de tip Spotify.

---

## Scenariu 3 — Partition Pruning (filtrare directă pe date_key)

**Cerere:** Număr total de fact-uri pentru luna martie 2024, cu filtru direct pe
cheia de partiționare `date_key`.

```sql
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM dw.dw_fact_listening_event
WHERE date_key BETWEEN 20240301 AND 20240331;
```

**Timp de execuție real: 13.343 ms**

```
Aggregate  (cost=6.17..6.18 rows=1 width=8)
           (actual time=13.289..13.290 rows=1 loops=1)
  Buffers: shared read=3
  ->  Index Only Scan using
        dw_fact_listening_event_2024_date_key_idx
        on dw_fact_listening_event_2024
        (cost=0.28..5.96 rows=84 width=0)
        (actual time=13.264..13.277 rows=84 loops=1)
        Index Cond: ((date_key >= 20240301) AND (date_key <= 20240331))
        Heap Fetches: 0
        Index Searches: 1
Planning Time:  7.092 ms
Execution Time: 13.343 ms
```

### Observații asupra planului

**Partition Pruning confirmat** — optimizatorul a identificat că intervalul
`[20240301, 20240331]` se află exclusiv în partiția `dw_fact_listening_event_2024`
(`FOR VALUES FROM (20240101) TO (20250101)`). Partițiile `2023`, `2025` și `default`
nu apar deloc în plan — sunt eliminate complet la faza de planificare.

**Index Only Scan** — PostgreSQL folosește indexul `dw_fact_listening_event_2024_date_key_idx`
și nu accesează heap-ul deloc (`Heap Fetches: 0`). Valoarea `COUNT(*)` este derivată
direct din index, fără a citi paginile de date. Acesta este cel mai eficient tip
de scan posibil.

**Contrast cu Scenariul 1** — în Scenariul 1, filtrul pe `year` era aplicat prin
join pe `dw_dim_date`, astfel optimizatorul nu știa la planificare că fact-urile
relevante sunt doar în partiția 2024. Filtrând direct pe `date_key` (cheia
de partiție), pruning-ul devine posibil și planul se reduce la un singur index scan.

**Concluzie de design:** pentru interogări frecvente pe intervale de timp,
este preferabil să se filtreze direct pe `date_key` (format `YYYYMMDD`) decât
prin join pe `dw_dim_date.year/month`. Aceasta este o bună practică documentată
în literatura DW pentru tabele partiționare range-based.

---

## Rezumat comparativ

| Scenariu                      | Strategie           | Execution Time | Observație cheie                        |
|-------------------------------|---------------------|---------------:|-----------------------------------------|
| 1. Fact Table + joins         | Hash Join + NL      | 48.853 ms      | 18.382 rânduri procesate, sort 1MB      |
| 2. Materialized View          | Seq Scan simplu     |  2.638 ms      | 310 rânduri, 0 join-uri, ~18.5× faster  |
| 3. Partition Pruning          | Index Only Scan     | 13.343 ms      | 1 partiție din 4, 0 heap fetches        |

Aceste rezultate validează trei decizii arhitecturale ale proiectului:
partiționarea tabelei de fapte pe `date_key`, crearea de materialized views
pentru rapoartele BI frecvente, și separarea schemei `dw` de schema operațională `oltp`.
