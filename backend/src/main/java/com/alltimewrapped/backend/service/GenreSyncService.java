package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.Genre;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.GenreRepository;
import com.alltimewrapped.backend.repository.TrackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenreSyncService {

    private final TrackRepository trackRepository;
    private final GenreRepository genreRepository;
    private final LastFmService lastFmService;

    @Async
    public void syncGenresAsync() {
        log.info("Starting background genre sync with Last.fm...");

        while (true) {
            List<Track> tracksToSync = trackRepository.findTop50ByGenresIsEmpty();

            if (tracksToSync.isEmpty()) {
                log.info("Finished genre sync. All tracks have genres.");
                break;
            }

            for (Track track : tracksToSync) {
                try {
                    List<String> tags = lastFmService.getArtistTopTags(track.getArtistName());

                    Set<Genre> genres;

                    if (tags.isEmpty()) {
                        genres = Set.of(findOrCreateGenre("unknown"));
                    } else {
                        genres = resolveGenres(tags);
                    }

                    track.setGenres(genres);
                    trackRepository.save(track);

                    // Small delay to avoid hitting rate limits too hard if using real API
                    Thread.sleep(100);
                } catch (Exception e) {
                    log.error("Error syncing track {}: {}", track.getArtistName(), e.getMessage());

                    track.setGenres(Set.of(findOrCreateGenre("error")));
                    trackRepository.save(track);
                }
            }

            log.info("Synced batch of 50 tracks...");
        }
    }

    private Set<Genre> resolveGenres(List<String> tags) {
        Set<Genre> genres = new HashSet<>();

        for (String tag : tags) {
            if (tag == null || tag.isBlank()) {
                continue;
            }

            genres.add(findOrCreateGenre(tag.trim()));
        }

        if (genres.isEmpty()) {
            genres.add(findOrCreateGenre("unknown"));
        }

        return genres;
    }

    private Genre findOrCreateGenre(String genreName) {
        return genreRepository.findByNameIgnoreCase(genreName)
                .orElseGet(() -> genreRepository.save(
                        Genre.builder()
                                .name(genreName)
                                .build()
                ));
    }
}