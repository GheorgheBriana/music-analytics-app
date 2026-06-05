# Music Analytics DW & BI - Dissertation Project

## Overview
This application is a comprehensive Data Warehouse (DW) and Business Intelligence (BI) solution built for personal music streaming analytics. It extracts raw listening data from operational sources (Spotify, JSON histories), transforms it via an internal ETL pipeline, and loads it into a PostgreSQL-backed Star Schema Data Warehouse. A modern React frontend serves as the BI Dashboard, presenting actionable insights.

## Architecture Highlights
- **OLTP vs. DW Separation:** Two distinct PostgreSQL schemas (`oltp` for transactional data, `dw` for analytical queries) to isolate workloads.
- **Star Schema Design:** `dw_fact_listening_event` partitioned by year, surrounded by dimensions (`User`, `Date`, `Time`, `Track`, `Artist`, `Album`, `Genre`, `Platform`, `Source`).
- **Materialized Views:** Pre-aggregated metrics for high-performance dashboard loading.
- **Advanced SQL Analytics:** Window functions (`DENSE_RANK`, `AVG OVER`), moving averages, and percentage calculations.
- **MusicBrainz Enrichment:** Automated metadata enrichment pipeline with rate limiting to fetch and link missing artist genres.
- **Data Warehouse Control Center:** A dedicated UI panel to manage ETL backfills and API enrichment processes.

## Technologies Used
- **Backend:** Java 17, Spring Boot 4.0.6, Spring Data JPA, JDBC Template, Spring Web MVC.
- **Frontend:** React 18, Vite, React Router, Recharts, D3.
- **Database:** PostgreSQL 15, with separate `oltp` and `dw` schemas.
- **Data Warehouse:** Star schema, fact table, dimensions, yearly partitioning, materialized views.
- **Messaging / Realtime:** RabbitMQ, Redis, WebSocket/STOMP.
- **External APIs:** Spotify Web API and MusicBrainz API for metadata enrichment.

## Getting Started

1. Start infrastructure:
```bash
docker compose up -d
```

> [!IMPORTANT]
> **Database Initialization:** Before starting the backend, make sure the PostgreSQL database is initialized with the required SQL scripts for:
> - The `oltp` schema
> - The `dw` schema
> - Materialized views
> - Performance indexes
> - MOBD/distributed database demo objects (if using this module)
>
> The application uses `spring.jpa.hibernate.ddl-auto=validate` and `spring.sql.init.mode=never`, meaning the database schema must already exist before the backend starts.

2. Configure environment variables:

For Windows PowerShell:
```powershell
$env:SPOTIFY_CLIENT_ID="your_client_id"
$env:SPOTIFY_CLIENT_SECRET="your_client_secret"
$env:DB_URL="jdbc:postgresql://localhost:5432/music_analytics?reWriteBatchedInserts=true"
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="postgres"
$env:LASTFM_API_KEY="dummy_key_please_replace"
```

For Linux/macOS:
```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
export DB_URL="jdbc:postgresql://localhost:5432/music_analytics?reWriteBatchedInserts=true"
export DB_USERNAME="postgres"
export DB_PASSWORD="postgres"
export LASTFM_API_KEY="dummy_key_please_replace"
```

3. Start backend:
```bash
cd backend
./mvnw spring-boot:run
```
On Windows:
```cmd
cd backend
.\mvnw.cmd spring-boot:run
```

4. Start frontend:
```bash
cd frontend
npm install
npm run dev
```

5. Open the application:
- Frontend: http://localhost:5173
- Swagger UI: http://localhost:8080/swagger-ui.html



## Documentation
For detailed architectural diagrams (ETL Flow, Star Schema), please refer to `architecture_diagrams.md`.