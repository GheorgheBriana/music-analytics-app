package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.Album;
import com.alltimewrapped.backend.model.Artist;
import com.alltimewrapped.backend.model.Genre;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AlbumRepository;
import com.alltimewrapped.backend.repository.ArtistRepository;
import com.alltimewrapped.backend.repository.GenreRepository;
import com.alltimewrapped.backend.repository.TrackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrackService {

    private final TrackRepository trackRepository;
    private final ArtistRepository artistRepository;
    private final AlbumRepository albumRepository;
    private final GenreRepository genreRepository;

    // Finds an existing track or creates a new one if it does not exist.
    // The method also makes sure the normalized OLTP relations are populated.
    @Transactional
    public Track findOrCreateTrack(String spotifyTrackUri, String trackName, String artistName, String albumName) {
        if (spotifyTrackUri != null) {
            return trackRepository.findBySpotifyTrackUri(spotifyTrackUri)
                    .map(existingTrack -> ensureOltpRelations(existingTrack, artistName, albumName))
                    .orElseGet(() -> createTrack(spotifyTrackUri, trackName, artistName, albumName));
        }

        return createTrack(null, trackName, artistName, albumName);
    }

    // Cache-aware version used during bulk import to avoid repeated DB lookups.
    // trackCache: spotifyTrackUri → Track
    // artistCache: lowerArtistName → Artist
    // albumCache: lowerAlbumName → Album
    @Transactional
    public Track findOrCreateTrack(
            String spotifyTrackUri,
            String trackName,
            String artistName,
            String albumName,
            Map<String, Track> trackCache,
            Map<String, Artist> artistCache,
            Map<String, Album> albumCache
    ) {
        // Genre cache is built lazily inside this call — "unknown" is looked up once and reused
        if (spotifyTrackUri != null && trackCache.containsKey(spotifyTrackUri)) {
            return trackCache.get(spotifyTrackUri);
        }

        // Ensure "unknown" genre is pre-cached on first call to avoid repeated DB hits
        // across all new track creations in the same import session
        Genre unknownGenre = findOrCreateGenre("unknown");

        Track track;
        if (spotifyTrackUri != null) {
            track = trackRepository.findBySpotifyTrackUri(spotifyTrackUri)
                    .map(existing -> ensureOltpRelations(existing, artistName, albumName, artistCache, albumCache, unknownGenre))
                    .orElseGet(() -> createTrack(spotifyTrackUri, trackName, artistName, albumName, artistCache, albumCache, unknownGenre));
        } else {
            track = createTrack(null, trackName, artistName, albumName, artistCache, albumCache, unknownGenre);
        }

        if (spotifyTrackUri != null) {
            trackCache.put(spotifyTrackUri, track);
        }
        return track;
    }

    // Creates and saves a new track with both the old fallback fields and the new OLTP relations.
    private Track createTrack(String spotifyTrackUri, String trackName, String artistName, String albumName) {
        Track track = new Track();

        String safeTrackName = normalizeValue(trackName, "Unknown Track");
        String safeArtistName = normalizeValue(artistName, "Unknown Artist");
        String safeAlbumName = normalizeValue(albumName, "Unknown Album");

        // These fields are kept for compatibility with the existing statistics queries
        track.setSpotifyTrackUri(spotifyTrackUri);
        track.setTrackName(safeTrackName);
        track.setArtistName(safeArtistName);
        track.setAlbumName(safeAlbumName);

        // New normalized OLTP relations
        Album album = findOrCreateAlbum(safeAlbumName);
        Artist artist = findOrCreateArtist(safeArtistName);
        Genre unknownGenre = findOrCreateGenre("unknown");

        track.setAlbum(album);
        track.getArtists().add(artist);
        track.getGenres().add(unknownGenre);

        return trackRepository.save(track);
    }

    // Cache-aware version of createTrack — uses local HashMaps to avoid repeated DB lookups
    // Accepts pre-fetched unknownGenre to avoid a DB hit per new track
    private Track createTrack(
            String spotifyTrackUri,
            String trackName,
            String artistName,
            String albumName,
            Map<String, Artist> artistCache,
            Map<String, Album> albumCache,
            Genre unknownGenre
    ) {
        Track track = new Track();

        String safeTrackName = normalizeValue(trackName, "Unknown Track");
        String safeArtistName = normalizeValue(artistName, "Unknown Artist");
        String safeAlbumName = normalizeValue(albumName, "Unknown Album");

        track.setSpotifyTrackUri(spotifyTrackUri);
        track.setTrackName(safeTrackName);
        track.setArtistName(safeArtistName);
        track.setAlbumName(safeAlbumName);

        Album album = findOrCreateAlbumCached(safeAlbumName, albumCache);
        Artist artist = findOrCreateArtistCached(safeArtistName, artistCache);

        track.setAlbum(album);
        track.getArtists().add(artist);
        track.getGenres().add(unknownGenre);

        return trackRepository.save(track);
    }

    // Cache-aware version of ensureOltpRelations — accepts pre-fetched unknownGenre.
    private Track ensureOltpRelations(
            Track track,
            String artistName,
            String albumName,
            Map<String, Artist> artistCache,
            Map<String, Album> albumCache,
            Genre unknownGenre
    ) {
        boolean changed = false;

        String safeArtistName = normalizeValue(artistName, track.getArtistName());
        String safeAlbumName = normalizeValue(albumName, track.getAlbumName());

        if (safeArtistName == null || safeArtistName.isBlank()) safeArtistName = "Unknown Artist";
        if (safeAlbumName == null || safeAlbumName.isBlank()) safeAlbumName = "Unknown Album";

        if (track.getArtistName() == null || track.getArtistName().isBlank()) {
            track.setArtistName(safeArtistName);
            changed = true;
        }
        if (track.getAlbumName() == null || track.getAlbumName().isBlank()) {
            track.setAlbumName(safeAlbumName);
            changed = true;
        }
        if (track.getAlbum() == null) {
            track.setAlbum(findOrCreateAlbumCached(safeAlbumName, albumCache));
            changed = true;
        }
        if (track.getArtists() == null || track.getArtists().isEmpty()) {
            track.getArtists().add(findOrCreateArtistCached(safeArtistName, artistCache));
            changed = true;
        }
        if (track.getGenres() == null || track.getGenres().isEmpty()) {
            track.getGenres().add(unknownGenre);
            changed = true;
        }

        if (changed) {
            return trackRepository.save(track);
        }
        return track;
    }

    // Cached artist lookup — avoids repeated findByArtistNameIgnoreCase during bulk import.
    private Artist findOrCreateArtistCached(String artistName, Map<String, Artist> cache) {
        String key = artistName.toLowerCase();
        return cache.computeIfAbsent(key, k -> findOrCreateArtist(artistName));
    }

    // Cached album lookup — avoids repeated findByAlbumNameIgnoreCase during bulk import.
    private Album findOrCreateAlbumCached(String albumName, Map<String, Album> cache) {
        String key = albumName.toLowerCase();
        return cache.computeIfAbsent(key, k -> findOrCreateAlbum(albumName));
    }
    private Track ensureOltpRelations(Track track, String artistName, String albumName) {
        boolean changed = false;

        String safeArtistName = normalizeValue(artistName, track.getArtistName());
        String safeAlbumName = normalizeValue(albumName, track.getAlbumName());

        if (safeArtistName == null || safeArtistName.isBlank()) {
            safeArtistName = "Unknown Artist";
        }

        if (safeAlbumName == null || safeAlbumName.isBlank()) {
            safeAlbumName = "Unknown Album";
        }

        if (track.getArtistName() == null || track.getArtistName().isBlank()) {
            track.setArtistName(safeArtistName);
            changed = true;
        }

        if (track.getAlbumName() == null || track.getAlbumName().isBlank()) {
            track.setAlbumName(safeAlbumName);
            changed = true;
        }

        if (track.getAlbum() == null) {
            track.setAlbum(findOrCreateAlbum(safeAlbumName));
            changed = true;
        }

        if (track.getArtists() == null || track.getArtists().isEmpty()) {
            track.getArtists().add(findOrCreateArtist(safeArtistName));
            changed = true;
        }

        if (track.getGenres() == null || track.getGenres().isEmpty()) {
            track.getGenres().add(findOrCreateGenre("unknown"));
            changed = true;
        }

        if (changed) {
            return trackRepository.save(track);
        }

        return track;
    }

    private Artist findOrCreateArtist(String artistName) {
        String safeArtistName = normalizeValue(artistName, "Unknown Artist");

        return artistRepository.findByArtistNameIgnoreCase(safeArtistName)
                .orElseGet(() -> artistRepository.save(
                        Artist.builder()
                                .artistName(safeArtistName)
                                .build()
                ));
    }

    private Album findOrCreateAlbum(String albumName) {
        String safeAlbumName = normalizeValue(albumName, "Unknown Album");

        return albumRepository.findByAlbumNameIgnoreCase(safeAlbumName)
                .orElseGet(() -> albumRepository.save(
                        Album.builder()
                                .albumName(safeAlbumName)
                                .build()
                ));
    }

    private Genre findOrCreateGenre(String genreName) {
        String safeGenreName = normalizeValue(genreName, "unknown");

        return genreRepository.findByNameIgnoreCase(safeGenreName)
                .orElseGet(() -> genreRepository.save(
                        Genre.builder()
                                .name(safeGenreName)
                                .build()
                ));
    }

    private String normalizeValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }
}