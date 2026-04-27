package com.alltimewrapped.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.alltimewrapped.backend.model.Track;
import java.util.Optional;

public interface TrackRepository extends JpaRepository<Track, Long> {

    Optional<Track> findBySpotifyTrackUri(String spotifyTrackUri);

    boolean existsBySpotifyTrackUri(String spotifyTrackUri);
}
