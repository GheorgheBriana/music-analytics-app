# DW Performance Demonstrations: EXPLAIN ANALYZE

This document outlines the performance characteristics of the Data Warehouse architecture by showcasing the actual execution plans for various queries. It provides academic proof of performance benefits obtained through Materialized Views and Partition Pruning. The examples specifically demonstrate filtering at the user level for equivalent comparisons.

---

## 1. Direct Query on Fact Table (Hash Join & Aggregation)
When querying the raw fact table `dw.dw_fact_listening_event` directly, the database must scan multiple partitions, apply the user filter, and perform heavy hash joins against dimension tables.

**Execution Time**: `48.853 ms`

```text
                                                                                      QUERY PLAN                                                                                      
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 GroupAggregate  (cost=728.63..730.46 rows=61 width=56) (actual time=45.468..48.412 rows=142.00 loops=1)
   Group Key: d.day_of_week, t.hour, d.day_name
   Buffers: shared hit=38986 read=15
   ->  Sort  (cost=728.63..728.78 rows=61 width=32) (actual time=45.419..45.888 rows=12882.00 loops=1)
         Sort Key: d.day_of_week, t.hour, d.day_name
         Sort Method: quicksort  Memory: 1033kB
         Buffers: shared hit=38986 read=15
         ->  Nested Loop  (cost=25.74..726.82 rows=61 width=32) (actual time=0.984..38.985 rows=12882.00 loops=1)
               Buffers: shared hit=38980 read=15
               ->  Hash Join  (cost=25.46..708.62 rows=61 width=36) (actual time=0.647..15.272 rows=12882.00 loops=1)
                     Hash Cond: (f.date_key = d.date_key)
                     Buffers: shared hit=349
                     ->  Hash Join  (cost=8.17..691.08 rows=95 width=32) (actual time=0.270..12.353 rows=12882.00 loops=1)
                           Hash Cond: (f.user_key = u.user_key)
                           Buffers: shared hit=343
                           ->  Append  (cost=0.00..632.13 rows=18942 width=40) (actual time=0.055..9.176 rows=18382.00 loops=1)
                                 Buffers: shared hit=338
                                 ->  Seq Scan on dw_fact_listening_event_2023 f_1  (cost=0.00..15.60 rows=560 width=40) (actual time=0.025..0.025 rows=0.00 loops=1)
                                 ->  Seq Scan on dw_fact_listening_event_2024 f_2  (cost=0.00..126.80 rows=4480 width=40) (actual time=0.029..2.089 rows=4480.00 loops=1)
                                       Buffers: shared hit=82
                                 ->  Seq Scan on dw_fact_listening_event_2025 f_3  (cost=0.00..336.70 rows=11870 width=40) (actual time=0.048..5.057 rows=11870.00 loops=1)
                                       Buffers: shared hit=218
                                 ->  Seq Scan on dw_fact_listening_event_default f_4  (cost=0.00..58.32 rows=2032 width=40) (actual time=0.053..0.750 rows=2032.00 loops=1)
                                       Buffers: shared hit=38
                           ->  Hash  (cost=8.16..8.16 rows=1 width=8) (actual time=0.114..0.115 rows=1.00 loops=1)
                                 Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                 Buffers: shared hit=5
                                 ->  Index Scan using uk_dw_dim_user_original_user_id on dw_dim_user u  (cost=0.14..8.16 rows=1 width=8) (actual time=0.104..0.105 rows=1.00 loops=1)
                                       Index Cond: (original_user_id = 2)
                                       Index Searches: 1
                                       Buffers: shared hit=5
                     ->  Hash  (cost=13.36..13.36 rows=314 width=20) (actual time=0.353..0.353 rows=359.00 loops=1)
                           Buckets: 1024  Batches: 1  Memory Usage: 28kB
                           Buffers: shared hit=6
                           ->  Seq Scan on dw_dim_date d  (cost=0.00..13.36 rows=314 width=20) (actual time=0.053..0.242 rows=359.00 loops=1)
                                 Filter: ((year = 2024) OR (year = 2025))
                                 Rows Removed by Filter: 132
                                 Buffers: shared hit=6
               ->  Index Scan using dw_dim_time_pkey on dw_dim_time t  (cost=0.28..0.30 rows=1 width=12) (actual time=0.002..0.002 rows=1.00 loops=12882)
                     Index Cond: (time_key = f.time_key)
                     Index Searches: 12882
                     Buffers: shared hit=38631 read=15
 Planning:
   Buffers: shared hit=1110 read=4 dirtied=1
 Planning Time: 34.593 ms
 Execution Time: 48.853 ms
```

---

## 2. Query via Materialized View
Hitting a pre-aggregated materialized view skips the costly join operations entirely, fetching the result using a single swift sequential scan (with user filtering applied).

**Execution Time**: `2.638 ms` *(over 18x faster than direct fact table querying)*

```text
                                                         QUERY PLAN                                                         
----------------------------------------------------------------------------------------------------------------------------
 Sort  (cost=12.95..13.31 rows=142 width=30) (actual time=2.560..2.565 rows=142.00 loops=1)
   Sort Key: day_of_week, hour
   Sort Method: quicksort  Memory: 32kB
   Buffers: shared hit=3 read=4
   ->  Seq Scan on mv_listening_heatmap  (cost=0.00..7.88 rows=142 width=30) (actual time=2.273..2.468 rows=142.00 loops=1)
         Filter: (original_user_id = 2)
         Rows Removed by Filter: 168
         Buffers: shared read=4
 Planning:
   Buffers: shared hit=58 read=1
 Planning Time: 2.253 ms
 Execution Time: 2.638 ms
```

---

## 3. Partition Pruning (Date Filtering)
The fact table `dw_fact_listening_event` is partitioned by `date_key`. When filtering for a specific time range (e.g., March 2024), PostgreSQL's optimizer prunes all irrelevant partitions (`2023`, `2025`, `default`), scanning only the matching partition via an index scan.

**Execution Time**: `13.343 ms`

```text
                                                                                                    QUERY PLAN                                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Aggregate  (cost=6.17..6.18 rows=1 width=8) (actual time=13.289..13.290 rows=1.00 loops=1)
   Buffers: shared read=3
   ->  Index Only Scan using dw_fact_listening_event_2024_date_key_idx on dw_fact_listening_event_2024 dw_fact_listening_event  (cost=0.28..5.96 rows=84 width=0) (actual time=13.264..13.277 rows=84.00 loops=1)
         Index Cond: ((date_key >= 20240301) AND (date_key <= 20240331))
         Heap Fetches: 0
         Index Searches: 1
         Buffers: shared read=3
 Planning:
   Buffers: shared hit=384
 Planning Time: 7.092 ms
 Execution Time: 13.343 ms
```
