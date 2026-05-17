package com.alltimewrapped.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import com.alltimewrapped.backend.model.Track;
import java.util.Optional;
import java.util.List;

public interface TrackRepository extends JpaRepository<Track, Long> {

    Optional<Track> findBySpotifyTrackUri(String spotifyTrackUri);

    boolean existsBySpotifyTrackUri(String spotifyTrackUri);

    List<Track> findTop50ByGenresIsEmpty();
    Optional<Track> findFirstByArtistName(String artistName);

    @Query("""
        select t
        from Track t
        where t.album is null
           or t.artists is empty
           or t.genres is empty
        """)
    Page<Track> findTracksNeedingBackfill(Pageable pageable);

    @Query("""
        select count(t)
        from Track t
        where t.album is null
           or t.artists is empty
           or t.genres is empty
        """)
    long countTracksNeedingBackfill();
}
