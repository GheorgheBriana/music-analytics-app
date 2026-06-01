-- OLTP Functional Indexes (LOWER functions for ignoreCase queries)
CREATE INDEX IF NOT EXISTS idx_oltp_artists_lower_name ON oltp.artists (LOWER(artist_name));
CREATE INDEX IF NOT EXISTS idx_oltp_albums_lower_name ON oltp.albums (LOWER(album_name));
CREATE INDEX IF NOT EXISTS idx_oltp_genres_lower_name ON oltp.genres (LOWER(name));

-- OLTP Performance Indexes for User Dashboard queries
CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user ON oltp.listening_records (user_id);
CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user_played ON oltp.listening_records (user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_oltp_tracks_artist ON oltp.tracks (artist_name);

-- DW Dimensions Indexes
CREATE INDEX IF NOT EXISTS idx_dw_dim_date_full_date ON dw.dw_dim_date (full_date);
CREATE INDEX IF NOT EXISTS idx_dw_dim_time_hm ON dw.dw_dim_time (hour, minute);
CREATE INDEX IF NOT EXISTS idx_dw_dim_platform_lower ON dw.dw_dim_platform (LOWER(platform_name));
CREATE INDEX IF NOT EXISTS idx_dw_dim_source_lower ON dw.dw_dim_source (LOWER(source_name));

-- DW Performance Indexes for ETL incremental checks
CREATE INDEX IF NOT EXISTS idx_dw_fact_original_record ON dw.dw_fact_listening_event (original_listening_record_id);
