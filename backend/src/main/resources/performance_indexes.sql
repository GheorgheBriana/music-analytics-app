-- OLTP Functional Indexes (LOWER functions for ignoreCase queries)
CREATE INDEX IF NOT EXISTS idx_oltp_artists_lower_name ON oltp.artists (LOWER(artist_name));
CREATE INDEX IF NOT EXISTS idx_oltp_albums_lower_name ON oltp.albums (LOWER(album_name));
CREATE INDEX IF NOT EXISTS idx_oltp_genres_lower_name ON oltp.genres (LOWER(name));

-- DW Dimensions Indexes
CREATE INDEX IF NOT EXISTS idx_dw_dim_date_full_date ON dw.dw_dim_date (full_date);
CREATE INDEX IF NOT EXISTS idx_dw_dim_time_hm ON dw.dw_dim_time (hour, minute);
CREATE INDEX IF NOT EXISTS idx_dw_dim_platform_lower ON dw.dw_dim_platform (LOWER(platform_name));
CREATE INDEX IF NOT EXISTS idx_dw_dim_source_lower ON dw.dw_dim_source (LOWER(source_name));
