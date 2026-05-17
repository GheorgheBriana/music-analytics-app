package com.alltimewrapped.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class LastFmService {

    @Value("${lastfm.api-key}")
    private String apiKey;

    @Value("${lastfm.api-url}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<String> getArtistTopTags(String artistName) {
        if ("dummy_key_please_replace".equals(apiKey)) {
            // Return some dummy genres for testing without API key
            // We use different dummy genres based on artist name length just to have variety
            if (artistName.length() < 5) return List.of("pop", "dance");
            if (artistName.length() < 8) return List.of("hip hop", "rap");
            if (artistName.length() < 12) return List.of("indie", "rock", "alternative");
            return List.of("electronic", "synth-pop");
        }

        try {
            String url = UriComponentsBuilder.fromUriString(apiUrl)
                    .queryParam("method", "artist.gettoptags")
                    .queryParam("artist", artistName)
                    .queryParam("api_key", apiKey)
                    .queryParam("format", "json")
                    .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("toptags")) {
                Map<String, Object> toptags = (Map<String, Object>) response.get("toptags");
                if (toptags.containsKey("tag")) {
                    List<Map<String, Object>> tags = (List<Map<String, Object>>) toptags.get("tag");
                    List<String> genreList = new ArrayList<>();
                    // Get top 3 tags
                    int limit = Math.min(tags.size(), 3);
                    for (int i = 0; i < limit; i++) {
                        String tagName = (String) tags.get(i).get("name");
                        if (tagName != null && !tagName.toLowerCase().contains("seen live")) {
                            genreList.add(tagName.toLowerCase());
                        }
                    }
                    return genreList;
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch tags for artist {}: {}", artistName, e.getMessage());
        }
        return new ArrayList<>();
    }

    public List<String> getTopArtistsByTag(String tag) {
        if ("dummy_key_please_replace".equals(apiKey)) {
            if (tag.equals("pop")) return List.of("Dua Lipa", "Harry Styles", "Olivia Rodrigo");
            if (tag.equals("rock")) return List.of("Arctic Monkeys", "The Strokes", "Tame Impala");
            if (tag.equals("hip hop")) return List.of("Kendrick Lamar", "J. Cole", "Travis Scott");
            return List.of("Gorillaz", "Oasis", "Radiohead", "Muse");
        }
        
        try {
            String url = UriComponentsBuilder.fromUriString(apiUrl)
                    .queryParam("method", "tag.gettopartists")
                    .queryParam("tag", tag)
                    .queryParam("api_key", apiKey)
                    .queryParam("format", "json")
                    .queryParam("limit", "10")
                    .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("topartists")) {
                Map<String, Object> topartists = (Map<String, Object>) response.get("topartists");
                if (topartists.containsKey("artist")) {
                    List<Map<String, Object>> artists = (List<Map<String, Object>>) topartists.get("artist");
                    List<String> artistList = new ArrayList<>();
                    for (Map<String, Object> artist : artists) {
                        artistList.add((String) artist.get("name"));
                    }
                    return artistList;
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch top artists for tag {}: {}", tag, e.getMessage());
        }
        return new ArrayList<>();
    }
}
