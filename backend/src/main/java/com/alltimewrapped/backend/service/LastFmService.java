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
            String cleanedTag = tag != null ? tag.toLowerCase().trim() : "";
            if (cleanedTag.contains("classical")) {
                return List.of(
                    "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Johann Sebastian Bach",
                    "Frédéric Chopin", "Pyotr Ilyich Tchaikovsky", "Claude Debussy",
                    "Antonio Vivaldi", "Franz Schubert", "Richard Wagner", "Giuseppe Verdi",
                    "Johannes Brahms", "Igor Stravinsky", "Giacomo Puccini", "Maurice Ravel",
                    "Sergei Rachmaninoff", "Gustav Mahler", "Edward Elgar", "George Frideric Handel"
                );
            }
            if (cleanedTag.contains("indie pop") || cleanedTag.contains("indie")) {
                return List.of(
                    "The xx", "Lana Del Rey", "Florence + The Machine", "Phoebe Bridgers",
                    "Mac DeMarco", "The Shins", "Clairo", "Beach House", "Local Natives",
                    "Wallows", "Girl in Red", "MGMT", "Foster the People", "Two Door Cinema Club",
                    "Phoenix", "Alt-J", "Vampire Weekend", "Bon Iver", "Cigarettes After Sex"
                );
            }
            if (cleanedTag.contains("pop")) {
                return List.of(
                    "Dua Lipa", "Harry Styles", "Olivia Rodrigo", "Taylor Swift", "Billie Eilish",
                    "The Weeknd", "Ariana Grande", "Ed Sheeran", "Justin Bieber", "Bruno Mars",
                    "Shawn Mendes", "Camila Cabello", "Selena Gomez", "Halsey", "Miley Cyrus",
                    "Katy Perry", "Lady Gaga", "Rihanna", "Beyoncé", "Sam Smith"
                );
            }
            if (cleanedTag.contains("rock")) {
                return List.of(
                    "Arctic Monkeys", "The Strokes", "Tame Impala", "Queen", "Led Zeppelin",
                    "Pink Floyd", "The Beatles", "AC/DC", "Nirvana", "Linkin Park",
                    "Red Hot Chili Peppers", "Green Day", "Coldplay", "Radiohead", "Muse",
                    "Foo Fighters", "U2", "The Rolling Stones", "Guns N' Roses", "Metallica"
                );
            }
            if (cleanedTag.contains("hip hop") || cleanedTag.contains("rap") || cleanedTag.contains("hiphop")) {
                return List.of(
                    "Kendrick Lamar", "J. Cole", "Travis Scott", "Drake", "Kanye West",
                    "Eminem", "Jay-Z", "Lil Wayne", "Snoop Dogg", "Tupac Shakur",
                    "The Notorious B.I.G.", "Post Malone", "Mac Miller", "Tyler, the Creator",
                    "Kid Cudi", "A$AP Rocky", "Future", "Lil Baby", "Young Thug", "Nas"
                );
            }
            if (cleanedTag.contains("electronic") || cleanedTag.contains("dance") || cleanedTag.contains("drum and bass") || cleanedTag.contains("dnb")) {
                return List.of(
                    "Daft Punk", "Disclosure", "Avicii", "Calvin Harris", "Skrillex",
                    "Deadmau5", "Flume", "Pendulum", "Chase & Status", "Sub Focus",
                    "Noisia", "Andy C", "Rudimental", "Netsky", "Wilkinson",
                    "The Chemical Brothers", "The Prodigy", "Aphex Twin", "Justice", "Kygo"
                );
            }
            return List.of(
                "Gorillaz", "Oasis", "Radiohead", "Muse", "Tame Impala",
                "David Bowie", "Michael Jackson", "Fleetwood Mac", "Elton John", "Frank Sinatra",
                "Bob Dylan", "Johnny Cash", "Abba", "Stevie Wonder", "Marvin Gaye",
                "Aretha Franklin", "Otis Redding", "Ray Charles", "Nina Simone", "Bill Withers"
            );
        }
        
        try {
            String url = UriComponentsBuilder.fromUriString(apiUrl)
                    .queryParam("method", "tag.gettopartists")
                    .queryParam("tag", tag)
                    .queryParam("api_key", apiKey)
                    .queryParam("format", "json")
                    .queryParam("limit", "50")
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
