package com.alltimewrapped.backend.dto;

import lombok.*;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ComparisonDTO {
    private String user1Name;
    private String user2Name;
    private int similarityScore;
    
    // NEW: per-dimension breakdown
    private DimensionScoreDTO artistScore;
    private DimensionScoreDTO trackScore;
    private DimensionScoreDTO genreScore;
    private DimensionScoreDTO rhythmScore;
    
    // Existing
    private List<String> commonArtists;
    private List<String> commonTracks;
    private List<String> recommendations;
    
    // NEW: Genre Compass
    private List<String> commonGenres;
    private List<String> onlyUser1Genres;
    private List<String> onlyUser2Genres;
}
