# Ghid Tehnic - Demonstrație MOBD (Baze de Date Distribuite)

Acest director conține scripturile SQL concepute special pentru a exemplifica conceptele de **Baze de Date Distribuite** (obiectul materiei **MOBD**) din cadrul tezei tale de disertație. 

---

## 📌 Structura fișierelor SQL

Folderul este organizat într-o succesiune logică strictă pentru a fi ușor de parcurs și prezentat în fața comisiei:

1. **`01_admin_action_log.sql`**
   - Creează tabela de audit `oltp.admin_action_log` pentru securitate și urmărirea acțiunilor administrative.
2. **`02_mv_unique_indexes.sql`**
   - Definește indecși fizici unici necesari pentru reîmprospătarea concurentă (`REFRESH MATERIALIZED VIEW CONCURRENTLY`) pe materialized views din Data Warehouse.
3. **`03_mobd_single_instance.sql`**
   - **Fragmentare Verticală & Transparență locală**:
     - Desparte tabela de profil în două fragmente fizice separate: date publice (`user_profile_data`) și date de securitate (`user_profile_sec`).
     - Definește vederea logică de transparență globală `v_user_profile`.
     - Implementează un trigger `INSTEAD OF UPDATE` pentru actualizare automată trans-fragment.
     - Implementează o replică locală `genres_replica` actualizată sincron prin trigger `AFTER`.
4. **`04_mobd_eu_setup.sql`**
   - **Nodul secundar Europa (EU)**:
     - De rulat pe a doua instanță de PostgreSQL (Port `5433` sau containerul Docker `music-analytics-db-eu`).
     - Inițializează schema `oltp` locală și tabela de ascultări locală `listening_records_eu`.
5. **`05_mobd_am_setup.sql`**
   - **Nodul primar America (AM / Host native sau Port 5432)**:
     - Activează extensia `postgres_fdw` (Foreign Data Wrapper, echivalentul Oracle *Database Link*).
     - Configurează serverul străin (`link_bd_eu`), user mapping securizat (parola `postgres`) și importă schema EU (`oltp_eu_link`).
     - **Fragmentare Orizontală**: Creează fragmentul local America (`listening_records_am`).
     - **Transparență de Acces (UNION ALL)**: Definește view-ul global de unificare `v_listening_records_global`.
     - **Rutare automată trans-server (Geo-Partitioning)**: Implementează trigger-ul `INSTEAD OF INSERT` care direcționează automat datele conform țării (RO, DE, FR, ES în nodul străin EU; US, CA, MX în cel local AM).
     - **Replicare trans-server**: Trigger `AFTER` care propagă instant adăugările/ștergerile/modificările de genuri muzicale din America către nodul Europa via FDW link.

---

## 🚀 Instrucțiuni Rulare Pas-cu-Pas pentru Demo

### Pasul A: Pornire Servicii
Asigură-te că ambele containere sau servicii sunt active:
```bash
docker-compose up -d
```
- Nodul America rulează pe portul `5432` (sau procesul local pe Windows).
- Nodul Europa rulează în Docker pe portul `5433`.

### Pasul B: Rularea Scripturilor pe Baza de Date
1. **Pe instanța primară (AM - port 5432)**:
   - Rulează `01_admin_action_log.sql`
   - Rulează `02_mv_unique_indexes.sql`
   - Rulează `03_mobd_single_instance.sql`
2. **Pe instanța secundară (EU - port 5433)**:
   - Conectează-te la `music_analytics_eu` pe portul `5433` (user `postgres`, parola `postgres`).
   - Rulează integral `04_mobd_eu_setup.sql`.
3. **Pe instanța primară (AM - port 5432)** pentru legătura distribuită:
   - Rulează integral `05_mobd_am_setup.sql`.

---

## ⚡ Scenariu de Susținere: Demonstrarea Rezilienței la Comisie

Aplicația ta este prevăzută cu un mecanism de **resiliență academică completă**. Dacă vrei să impresionezi comisia:
1. Accesează panoul administrativ **Control Center MOBD** în frontend.
2. Închide nodul Europa din terminal:
   ```bash
   docker stop music-analytics-db-eu
   ```
3. Observă cum interfața React detectează oprirea și afișează un banner elegant de avertizare: 
   *"Europe database node is offline. Showing America local records only (Resilience Fallback)"*.
4. **Demonstrează reziliența**: datele locale din America sunt în continuare accesibile și complet funcționale, iar aplicația nu suferă niciun crash general datorită blocurilor `try-catch` și fallback-ului robust implementat în controller-ul backend.
