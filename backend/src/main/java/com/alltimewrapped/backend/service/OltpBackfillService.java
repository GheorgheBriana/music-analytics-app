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

        Genre unknownGenre = findOrCreateGenre("unknown");

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
                Album album = findOrCreateAlbum(albumName);
                track.setAlbum(album);
                createdAlbumLinks++;
                changed = true;
            }

            boolean artistAlreadyLinked = track.getArtists()
                    .stream()
                    .anyMatch(artist -> artist.getArtistName() != null
                            && artist.getArtistName().equalsIgnoreCase(artistName));

            if (!artistAlreadyLinked) {
                Artist artist = findOrCreateArtist(artistName);
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

    private Artist findOrCreateArtist(String artistName) {
        return artistRepository.findByArtistNameIgnoreCase(artistName)
                .orElseGet(() -> artistRepository.save(
                        Artist.builder()
                                .artistName(artistName)
                                .build()
                ));
    }

    private Album findOrCreateAlbum(String albumName) {
        return albumRepository.findByAlbumNameIgnoreCase(albumName)
                .orElseGet(() -> albumRepository.save(
                        Album.builder()
                                .albumName(albumName)
                                .build()
                ));
    }

    private Genre findOrCreateGenre(String genreName) {
        return genreRepository.findByNameIgnoreCase(genreName)
                .orElseGet(() -> genreRepository.save(
                        Genre.builder()
                                .name(genreName)
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