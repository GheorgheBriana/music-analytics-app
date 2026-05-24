package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComparisonDTO {
    private String user1Name;
    private String user2Name;
    private int similarityScore;
    private List<String> commonArtists;
    private List<String> commonTracks;
    private List<String> recommendations;
}
