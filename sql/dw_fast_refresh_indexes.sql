-- Database Performance Indexes for Fast OLTP -> DW Refresh Pipeline
-- These indexes are also verified and created automatically by the backend at startup
-- (see com.alltimewrapped.backend.config.DatabaseIndexInitializer)

CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_user_id
ON oltp.listening_records(user_id, id);

CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_track_id
ON oltp.listening_records(track_id);

CREATE INDEX IF NOT EXISTS idx_oltp_listening_records_played_at
ON oltp.listening_records(played_at);

CREATE INDEX IF NOT EXISTS idx_oltp_tracks_album_id
ON oltp.tracks(album_id);

CREATE INDEX IF NOT EXISTS idx_dw_fact_original_record_id
ON dw.dw_fact_listening_event(original_listening_record_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_user_original_id
ON dw.dw_dim_user(original_user_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_track_original_id
ON dw.dw_dim_track(original_track_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_artist_original_id
ON dw.dw_dim_artist(original_artist_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_album_original_id
ON dw.dw_dim_album(original_album_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_genre_original_id
ON dw.dw_dim_genre(original_genre_id);

CREATE INDEX IF NOT EXISTS idx_dw_dim_date_full_date
ON dw.dw_dim_date(full_date);

CREATE INDEX IF NOT EXISTS idx_dw_dim_time_hour_minute
ON dw.dw_dim_time(hour, minute);

CREATE INDEX IF NOT EXISTS idx_dw_dim_platform_name_lower
ON dw.dw_dim_platform(LOWER(platform_name));

CREATE INDEX IF NOT EXISTS idx_dw_dim_source_name_lower
ON dw.dw_dim_source(LOWER(source_name));
