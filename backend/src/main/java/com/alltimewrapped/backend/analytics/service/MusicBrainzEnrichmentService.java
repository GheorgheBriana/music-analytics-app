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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
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

    private static final Set<String> IGNORED_TAGS = Set.of(
            "2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "1960s",
            "seen live", "favorite", "favorites", "favourite", "favourites",
            "loved", "loved tracks", "good", "awesome", "beautiful",
            "male vocalists", "female vocalists", "singer-songwriter"
    );

    @Transactional
    public Map<String, Object> enrichArtists(int limit) {
        Page<Artist> unenrichedArtists = artistRepository.findByGenreEnrichedFalse(PageRequest.of(0, limit));
        
        int processed = 0;
        int foundTags = 0;

        for (Artist artist : unenrichedArtists) {
            try {
                enrichSingleArtist(artist);
                processed++;
                if (!artist.getTracks().isEmpty() && !artist.getTracks().iterator().next().getGenres().isEmpty()) {
                    foundTags++;
                }
                
                // Rate limiting for MusicBrainz: 1 request per second
                Thread.sleep(1100);
            } catch (Exception e) {
                log.error("Failed to enrich artist: " + artist.getArtistName(), e);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "MusicBrainz enrichment completed");
        result.put("limit", limit);
        result.put("processed", processed);
        result.put("artistsEnrichedWithTags", foundTags);
        return result;
    }

    private void enrichSingleArtist(Artist artist) throws Exception {
        String url = UriComponentsBuilder.fromUriString("https://musicbrainz.org/ws/2/artist")
                .queryParam("query", artist.getArtistName())
                .queryParam("fmt", "json")
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "MusicAnalyticsApp/1.0 ( dw@example.com )");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

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
            String name = tagNode.path("name").asText("").toLowerCase();
            int count = tagNode.path("count").asInt(0);

            if (count > 0 && !IGNORED_TAGS.contains(name) && name.length() > 2) {
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
            Genre genre = genreRepository.findByNameIgnoreCase(tr.name)
                    .orElseGet(() -> genreRepository.save(Genre.builder().name(tr.name).build()));
            genreEntities.add(genre);
        }

        for (Track track : artist.getTracks()) {
            track.getGenres().addAll(genreEntities);
            trackRepository.save(track);
        }

        markAsEnriched(artist, mbId, "success");
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
