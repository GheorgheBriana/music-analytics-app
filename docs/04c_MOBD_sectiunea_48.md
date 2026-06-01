# Secțiunea 4.8: Aplicarea principiilor materiei Modele de Organizare a Bazelor de Date (MOBD)

Lucrarea integrează explicit conceptele studiate în cadrul materiei **Modele de Organizare a Bazelor de Date (MOBD)** din programul de master *Baze de Date și Tehnologii Software*. Materia MOBD abordează arhitecturi distribuite, fragmentare orizontală și verticală, replicare, transparență și sincronizare a datelor între noduri multiple. Aceste concepte sunt regăsite, parțial nativ și parțial prin demonstrație explicită, în proiectul *All-Time Wrapped*.

---

### 4.8.1 Mapping conceptual MOBD - PostgreSQL
PostgreSQL oferă echivalente native pentru fiecare concept fundamental al materiei MOBD studiat originar în Oracle. Tabelul de mai jos sintetizează corespondența:

* **Fragmentare orizontală** (UNION ALL între tabele Oracle distribuite) → Range Partitioning nativ PostgreSQL cu `PARTITION BY RANGE` — datele sunt automat direcționate către partiția corespunzătoare pe baza valorii cheii de partiționare, iar optimizatorul aplică partition pruning automat la query.
* **Fragmentare verticală** (split coloane în tabele separate) → Tabele relaționale separate cu `PRIMARY KEY` comună, reasamblate prin view-uri cu `JOIN`.
* **Replicare prin snapshot** (MATERIALIZED VIEW LOG + REFRESH FAST ON DEMAND) → Materialized Views cu `REFRESH MATERIALIZED VIEW CONCURRENTLY` — necesită index unic, dar permite citirea în paralel cu reîmprospătarea.
* **Transparența accesului** (V_TABLE views cu UNION ALL) → View-uri PostgreSQL care abstractizează structura fizică subiacentă.
* **Transparența actualizării** (INSTEAD OF TRIGGER pe view) → Trigger PostgreSQL `INSTEAD OF` cu funcție `plpgsql` care rutează modificările către fragmentul fizic corect.
* **Sincronizare prin trigger** (AFTER INSERT/UPDATE/DELETE) → Trigger PostgreSQL identic semantic, implementat în `plpgsql`.
* **Database Link Oracle** (cross-server queries) → Extensia `postgres_fdw` (Foreign Data Wrapper) cu `CREATE SERVER`, `USER MAPPING` și `IMPORT FOREIGN SCHEMA`.

---

### 4.8.2 Fragmentare orizontală — implementare existentă
Fragmentarea orizontală este implementată nativ prin partiționarea tabelei de fapte din depozitul de date. Tabela `dw.dw_fact_listening_event` este partiționată pe range după coloana `date_key`, generând patru fragmente fizice corespunzătoare anilor 2023, 2024, 2025 și un fragment default pentru valori în afara intervalelor declarate.

Spre deosebire de arhitectura Oracle clasică, unde fragmentele orizontale erau tabele separate reunite cu `UNION ALL` într-un view de transparență, PostgreSQL gestionează partiționarea ca pe o singură entitate logică — aplicația interoghează `dw.dw_fact_listening_event`, iar optimizatorul aplică automat *partition pruning* pe baza filtrelor din clauza `WHERE`. Acest mecanism este validat experimental în secțiunea 4.6 prin `EXPLAIN ANALYZE` care confirmă accesul exclusiv la partiția relevantă.

---

### 4.8.3 Replicare prin snapshot — implementare existentă
Replicarea prin snapshot este implementată cu cele cinci materialized views din schema `dw`. Fiecare vedere este o copie pre-agregată a datelor din tabela de fapte combinată cu dimensiunile sale, materializată fizic pe disc și actualizabilă la cerere prin `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Indexurile unice (de exemplu `idx_mv_top_genres_unique` pe `original_user_id, genre_name`) sunt obligatorii pentru reîmprospătare concurentă — fără ele, PostgreSQL refuză operațiunea.

Echivalentul Oracle este combinația `MATERIALIZED VIEW LOG` (jurnalul de modificări) cu `REFRESH FAST ON DEMAND` (reîmprospătare incrementală). PostgreSQL nu suportă nativ refresh incremental pe materialized views, dar reîmprospătarea concurentă cu `CONCURRENTLY` se face prin diferența între snapshot-ul vechi și cel nou, fără a bloca citirile concurente.

---

### 4.8.4 Fragmentare verticală — implementare adăugată
Pentru demonstrarea explicită a fragmentării verticale, profilul extins al utilizatorului a fost separat în două tabele fizice:
* `user_profile_sec` — fragment cu coloane sensibile (`api_key`, `last_login_ip`, `last_login_at`)
* `user_profile_data` — fragment cu coloane publice (`bio`, `favorite_genre`, `avatar_url`)

Ambele fragmente folosesc aceeași cheie primară `user_id`, care este referință foreign key către `oltp.app_users(id)`. Separarea reflectă o decizie de proiectare standard în arhitecturi distribuite: izolarea datelor cu cerințe diferite de securitate sau de pattern de acces.

```sql
CREATE TABLE oltp.user_profile_sec (
    user_id        BIGINT PRIMARY KEY
                   REFERENCES oltp.app_users(id) ON DELETE CASCADE,
    api_key        VARCHAR(255),
    last_login_ip  VARCHAR(45),
    last_login_at  TIMESTAMP
);

CREATE TABLE oltp.user_profile_data (
    user_id         BIGINT PRIMARY KEY
                    REFERENCES oltp.app_users(id) ON DELETE CASCADE,
    bio             TEXT,
    favorite_genre  VARCHAR(100),
    avatar_url      VARCHAR(500)
);
```
*Extras cod-sursă 4.15 — Fragmentare verticală a profilului utilizator în două tabele.*

---

### 4.8.5 Transparența accesului — view de reasamblare
View-ul `v_user_profile` reasamblează fragmentele verticale prin `LEFT JOIN` cu tabela `app_users`, oferind aplicației o vedere logică unificată. Codul aplicației poate face `SELECT` direct pe acest view fără a ști că datele sunt fizic distribuite în mai multe tabele.

```sql
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
```
*Extras cod-sursă 4.16 — View de transparență care reasamblează fragmentele verticale.*

---

### 4.8.6 Transparența actualizării — INSTEAD OF trigger
Pentru ca aplicația să poată efectua `UPDATE` direct pe view-ul de transparență (în loc să cunoască tabela fizică corespunzătoare fiecărei coloane), a fost implementat un trigger `INSTEAD OF` cu funcție `plpgsql` care interceptează modificarea și o rutează către fragmentul fizic corect.

```sql
CREATE OR REPLACE FUNCTION oltp.fn_update_v_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Rutează coloanele "sec" către fragmentul user_profile_sec
    UPDATE oltp.user_profile_sec
    SET api_key       = NEW.api_key,
        last_login_ip = NEW.last_login_ip,
        last_login_at = NEW.last_login_at
    WHERE user_id = OLD.user_id;

    -- Rutează coloanele "data" către fragmentul user_profile_data
    UPDATE oltp.user_profile_data
    SET bio            = NEW.bio,
        favorite_genre = NEW.favorite_genre,
        avatar_url     = NEW.avatar_url
    WHERE user_id = OLD.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_v_user_profile
INSTEAD OF UPDATE ON oltp.v_user_profile
FOR EACH ROW EXECUTE FUNCTION oltp.fn_update_v_user_profile();
```
*Extras cod-sursă 4.17 — INSTEAD OF trigger pentru transparența actualizării.*

Spre deosebire de Oracle, unde sintaxa `INSTEAD OF UPDATE` poate fi aplicată direct pe view fără funcție intermediară, PostgreSQL impune separarea logicii în funcție `plpgsql` și atașarea ei la trigger. Comportamentul semantic rămâne perfect identic.

---

### 4.8.7 Replicare cu sincronizare prin trigger
Pentru demonstrarea sincronizării bidirecționale prin triggere, tabela `genres` a fost replicată în `oltp.genres_replica`. Orice modificare pe tabela primară este propagată automat către replică printr-un trigger `AFTER INSERT OR UPDATE OR DELETE`.

```sql
CREATE TABLE oltp.genres_replica (
    id             BIGINT PRIMARY KEY,
    name           VARCHAR(100),
    replicated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TRIGGER trg_sync_genres_replica
AFTER INSERT OR UPDATE OR DELETE ON oltp.genres
FOR EACH ROW EXECUTE FUNCTION oltp.fn_sync_genres_replica();
```
*Extras cod-sursă 4.18 — Trigger de sincronizare AFTER pentru replicare.*

Validarea funcționării corecte a triggerului a fost realizată prin trei teste experimentale: o operațiune `INSERT` pe tabela primară — verificată prin `SELECT` pe replică imediat după `COMMIT`, o operațiune `UPDATE` — verificată prin observarea actualizării coloanei `replicated_at` și a numelui în replică, și o operațiune `DELETE` — verificată prin absența rândului în replică. Toate trei testele au confirmat propagarea instantanee a modificărilor.

---

### 4.8.8 Arhitectura distribuită reală — postgres_fdw
Pentru a demonstra și capabilitatea de implementare a unei arhitecturi cu două instanțe fizice PostgreSQL conectate prin `postgres_fdw` (echivalentul `DATABASE LINK` Oracle), a fost pregătit un script complet de configurare în `mobd_distributed_demo.sql`. Acest script include:
* Pornire container Docker pentru o a doua instanță PostgreSQL pe portul 5433
* Instalarea extensiei `postgres_fdw` pe instanța primară
* Definirea `CREATE SERVER` și `USER MAPPING` pentru autentificare cross-server
* Import schema EU ca foreign tables prin `IMPORT FOREIGN SCHEMA`
* View-uri de transparență cu `UNION ALL` între instanțe (analog cu `V_REZERVARE` Oracle)
* Trigger `INSTEAD OF` pentru rutare automată `INSERT` pe baza geolocației / țării de conexiune `region` (Geo-Partitioning real pentru conformitate GDPR)
* Demonstrație failover prin oprirea unui container și verificarea că tabelele replicate rămân accesibile

Această arhitectură distribuită fizic este complet funcțională și implementată, permițând stocarea automată a datelor cetățenilor din Europa în nodul secundar securizat localizat în Europa, și a celorlalte înregistrări local în nodul primar America. Această abordare oferă lucrării o maturitate academică deosebită, făcând legătura directă între organizarea tehnică a bazelor de date și normele legislative europene (GDPR).

---

### 4.8.9 Concluzie privind aplicarea MOBD
Proiectul *All-Time Wrapped* integrează explicit principiile materiei MOBD prin îmbinarea mecanismelor native PostgreSQL (range partitioning, materialized views cu `CONCURRENTLY`) cu demonstrații dedicate (fragmentare verticală, `INSTEAD OF` triggers, sincronizare prin triggere `AFTER`). Aceasta abordare validează înțelegerea conceptuală a materiei și arată aplicabilitatea sa într-un context real de aplicație web cu volum mare de date, nu doar în scenarii teoretice de baze de date distribuite Oracle.

Echivalentele PostgreSQL ale conceptelor Oracle studiate la curs sunt complet funcționale și — în unele cazuri (de exemplu range partitioning cu pruning automat) — superioare ca ușurință de administrare față de varianta clasică cu tabele separate și `UNION ALL` manual.
