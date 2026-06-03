package com.alltimewrapped.backend.analytics.service;

import com.alltimewrapped.backend.model.Artist;
import com.alltimewrapped.backend.model.Genre;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.ArtistRepository;
import com.alltimewrapped.backend.repository.GenreRepository;
import com.alltimewrapped.backend.repository.TrackRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MusicBrainzEnrichmentService {

    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final TrackRepository trackRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    @Lazy
    private MusicBrainzEnrichmentService self;

    private static final Set<String> IGNORED_TAGS = Set.of(
            "2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "1960s",
            "seen live", "favorite", "favorites", "favourite", "favourites",
            "loved", "loved tracks", "good", "awesome", "beautiful",
            "male vocalists", "female vocalists", "singer-songwriter"
    );

    @Transactional(readOnly = true)
    public Map<String, Object> enrichArtists(int limit) {
        Page<Artist> unenrichedArtists = artistRepository.findByGenreEnrichedFalse(PageRequest.of(0, limit));
        
        int processed = 0;
        int foundTags = 0;

        for (Artist artist : unenrichedArtists) {
            try {
                // Execute individual artist enrichment in a separate transaction using the self-proxy
                self.enrichSingleArtistTransactional(artist.getId());
                processed++;
                
                // Reload from DB to verify if genres were mapped
                Artist reloaded = artistRepository.findById(artist.getId()).orElse(artist);
                if (!reloaded.getTracks().isEmpty() && !reloaded.getTracks().iterator().next().getGenres().isEmpty()) {
                    foundTags++;
                }
                
                // Rate limiting for MusicBrainz: 1 request per second
                Thread.sleep(1100);
            } catch (Exception e) {
                log.error("Failed to enrich artist ID " + artist.getId() + " (" + artist.getArtistName() + "): " + e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "MusicBrainz enrichment completed");
        result.put("limit", limit);
        result.put("processed", processed);
        result.put("artistsEnrichedWithTags", foundTags);
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void enrichSingleArtistTransactional(Long artistId) throws Exception {
        Artist artist = artistRepository.findById(artistId)
                .orElseThrow(() -> new IllegalArgumentException("Artist not found with ID: " + artistId));
        enrichSingleArtist(artist);
    }

    private void enrichSingleArtist(Artist artist) throws Exception {
        String queryStr = "artist:\"" + artist.getArtistName().replace("\"", "\\\"") + "\"";
        java.net.URI uri = UriComponentsBuilder.fromUriString("https://musicbrainz.org/ws/2/artist")
                .queryParam("query", queryStr)
                .queryParam("fmt", "json")
                .build()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "MusicAnalyticsApp/1.0 ( dw@example.com )");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            markAsEnriched(artist, null, "musicbrainz_error");
            return;
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode artistsNode = root.path("artists");

        if (artistsNode.isMissingNode() || !artistsNode.isArray() || artistsNode.isEmpty()) {
            markAsEnriched(artist, null, "not_found");
            return;
        }

        // Get the first artist result that matches closest
        JsonNode firstArtist = artistsNode.get(0);
        String mbId = firstArtist.path("id").asText(null);
        JsonNode tagsNode = firstArtist.path("tags");

        if (tagsNode.isMissingNode() || !tagsNode.isArray() || tagsNode.isEmpty()) {
            markAsEnriched(artist, mbId, "no_tags");
            return;
        }

        // Parse, filter and sort tags
        List<TagRecord> validTags = new ArrayList<>();
        for (JsonNode tagNode : tagsNode) {
            String name = tagNode.path("name").asText("").trim().toLowerCase();
            int count = tagNode.path("count").asInt(0);

            if (count > 0 && !name.isBlank() && !IGNORED_TAGS.contains(name) && name.length() > 2
                    && !name.equalsIgnoreCase(artist.getArtistName())) {
                validTags.add(new TagRecord(name, count));
            }
        }

        validTags.sort((a, b) -> Integer.compare(b.count, a.count));

        // Take top 3
        List<TagRecord> topTags = validTags.stream().limit(3).collect(Collectors.toList());

        if (topTags.isEmpty()) {
            markAsEnriched(artist, mbId, "no_valid_tags");
            return;
        }

        // Associate top tags to the artist's tracks
        Set<Genre> genreEntities = new HashSet<>();
        for (TagRecord tr : topTags) {
            Genre genre = getOrCreateGenreSafe(tr.name);
            if (genre != null) {
                genreEntities.add(genre);
            }
        }

        for (Track track : artist.getTracks()) {
            track.getGenres().addAll(genreEntities);
            trackRepository.save(track);
        }

        markAsEnriched(artist, mbId, "success");
    }

    private Genre getOrCreateGenreSafe(String rawName) {
        if (rawName == null || rawName.trim().isBlank()) {
            return null;
        }

        String normalizedName = rawName.trim().toLowerCase();

        return genreRepository.findByNameIgnoreCase(normalizedName)
                .orElseGet(() -> {
                    try {
                        Genre newGenre = Genre.builder().name(normalizedName).build();
                        return genreRepository.saveAndFlush(newGenre);
                    } catch (Exception ex) {
                        log.warn("Unique constraint or duplicate key violation for genre '{}', reloading...", normalizedName);
                        // Reload from database to ensure consistency and reuse the existing one
                        return genreRepository.findByNameIgnoreCase(normalizedName)
                                .orElse(null);
                    }
                });
    }

    private void markAsEnriched(Artist artist, String mbId, String source) {
        artist.setMusicBrainzId(mbId);
        artist.setGenreEnriched(true);
        artist.setGenreSource(source);
        artist.setGenreEnrichedAt(LocalDateTime.now());
        artistRepository.save(artist);
    }

    private record TagRecord(String name, int count) {}
}
