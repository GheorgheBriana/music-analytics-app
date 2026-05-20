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

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OltpBackfillService {

    private final TrackRepository trackRepository;
    private final ArtistRepository artistRepository;
    private final AlbumRepository albumRepository;
    private final GenreRepository genreRepository;

    @Transactional
    public Map<String, Object> backfillTrackRelations(int limit) {
        long remainingBefore = trackRepository.countTracksNeedingBackfill();

        List<Track> tracks = trackRepository.findTracksNeedingBackfill(
                org.springframework.data.domain.PageRequest.of(0, limit)
        ).getContent();

        int processedTracks = 0;
        int updatedTracks = 0;
        int createdArtistLinks = 0;
        int createdGenreLinks = 0;
        int createdAlbumLinks = 0;

        Map<String, Artist> artistCache = new HashMap<>();
        Map<String, Album> albumCache = new HashMap<>();
        Map<String, Genre> genreCache = new HashMap<>();

        Genre unknownGenre = findOrCreateGenre("unknown", genreCache);

        for (Track track : tracks) {
            processedTracks++;
            boolean changed = false;

            String artistName = normalizeValue(track.getArtistName(), "Unknown Artist");
            String albumName = normalizeValue(track.getAlbumName(), "Unknown Album");

            if (track.getArtists() == null) {
                track.setArtists(new java.util.HashSet<>());
            }

            if (track.getGenres() == null) {
                track.setGenres(new java.util.HashSet<>());
            }

            if (track.getAlbum() == null) {
                Album album = findOrCreateAlbum(albumName, albumCache);
                track.setAlbum(album);
                createdAlbumLinks++;
                changed = true;
            }

            boolean artistAlreadyLinked = track.getArtists()
                    .stream()
                    .anyMatch(artist -> artist.getArtistName() != null
                            && artist.getArtistName().equalsIgnoreCase(artistName));

            if (!artistAlreadyLinked) {
                Artist artist = findOrCreateArtist(artistName, artistCache);
                track.getArtists().add(artist);
                createdArtistLinks++;
                changed = true;
            }

            if (track.getGenres().isEmpty()) {
                track.getGenres().add(unknownGenre);
                createdGenreLinks++;
                changed = true;
            }

            if (changed) {
                trackRepository.save(track);
                updatedTracks++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "OLTP backfill batch completed successfully");
        result.put("limit", limit);
        result.put("processedTracks", processedTracks);
        result.put("updatedTracks", updatedTracks);
        result.put("createdAlbumLinks", createdAlbumLinks);
        result.put("createdArtistLinks", createdArtistLinks);
        result.put("createdGenreLinks", createdGenreLinks);

        long remainingAfter = trackRepository.countTracksNeedingBackfill();

        result.put("remainingBefore", remainingBefore);
        result.put("remainingAfter", remainingAfter);

        return result;
    }

    private Artist findOrCreateArtist(String artistName, Map<String, Artist> cache) {
        String key = artistName.toLowerCase();
        if (cache.containsKey(key)) return cache.get(key);
        
        Artist artist = artistRepository.findByArtistNameIgnoreCase(artistName)
                .orElseGet(() -> artistRepository.save(
                        Artist.builder()
                                .artistName(artistName)
                                .build()
                ));
        cache.put(key, artist);
        return artist;
    }

    private Album findOrCreateAlbum(String albumName, Map<String, Album> cache) {
        String key = albumName.toLowerCase();
        if (cache.containsKey(key)) return cache.get(key);
        
        Album album = albumRepository.findByAlbumNameIgnoreCase(albumName)
                .orElseGet(() -> albumRepository.save(
                        Album.builder()
                                .albumName(albumName)
                                .build()
                ));
        cache.put(key, album);
        return album;
    }

    private Genre findOrCreateGenre(String genreName, Map<String, Genre> cache) {
        String key = genreName.toLowerCase();
        if (cache.containsKey(key)) return cache.get(key);
        
        Genre genre = genreRepository.findByNameIgnoreCase(genreName)
                .orElseGet(() -> genreRepository.save(
                        Genre.builder()
                                .name(genreName)
                                .build()
                ));
        cache.put(key, genre);
        return genre;
    }

    private String normalizeValue(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }
}