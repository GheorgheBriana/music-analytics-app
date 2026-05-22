package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ComparisonDTO;
import com.alltimewrapped.backend.dto.TopArtistStatsDTO;
import com.alltimewrapped.backend.dto.TopTrackStatsDTO;
import com.alltimewrapped.backend.dto.UserDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SocialService {

    private final AppUserRepository appUserRepository;
    private final ListeningRecordRepository listeningRecordRepository;

    @Transactional(readOnly = true)
    public List<UserDTO> getAllUsers() {
        return appUserRepository.findAll().stream()
                .map(user -> new UserDTO(user.getId(), user.getUsername()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ComparisonDTO compareUsers(Long userId1, Long userId2) {
        AppUser user1 = appUserRepository.findById(userId1)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 1 not found"));
        AppUser user2 = appUserRepository.findById(userId2)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User 2 not found"));

        // Load top 100 artists for both users
        List<TopArtistStatsDTO> u1Artists = listeningRecordRepository.findTopArtistsByUserId(userId1, PageRequest.of(0, 100));
        List<TopArtistStatsDTO> u2Artists = listeningRecordRepository.findTopArtistsByUserId(userId2, PageRequest.of(0, 100));

        Set<String> u1ArtistNames = u1Artists.stream().map(TopArtistStatsDTO::getArtistName).collect(Collectors.toSet());
        Set<String> u2ArtistNames = u2Artists.stream().map(TopArtistStatsDTO::getArtistName).collect(Collectors.toSet());

        Set<String> commonArtists = new HashSet<>(u1ArtistNames);
        commonArtists.retainAll(u2ArtistNames);
        
        Set<String> unionArtists = new HashSet<>(u1ArtistNames);
        unionArtists.addAll(u2ArtistNames);

        double artistSimilarity = unionArtists.isEmpty() ? 0 : (double) commonArtists.size() / unionArtists.size();

        // Load top 100 tracks for both users
        List<TopTrackStatsDTO> u1Tracks = listeningRecordRepository.findTopTracksByUserId(userId1, PageRequest.of(0, 100));
        List<TopTrackStatsDTO> u2Tracks = listeningRecordRepository.findTopTracksByUserId(userId2, PageRequest.of(0, 100));

        Set<String> u1TrackNames = u1Tracks.stream().map(TopTrackStatsDTO::getTrackName).collect(Collectors.toSet());
        Set<String> u2TrackNames = u2Tracks.stream().map(TopTrackStatsDTO::getTrackName).collect(Collectors.toSet());

        Set<String> commonTracks = new HashSet<>(u1TrackNames);
        commonTracks.retainAll(u2TrackNames);

        Set<String> unionTracks = new HashSet<>(u1TrackNames);
        unionTracks.addAll(u2TrackNames);

        double trackSimilarity = unionTracks.isEmpty() ? 0 : (double) commonTracks.size() / unionTracks.size();

        // Final score: 70% artists + 30% tracks
        int finalScore = (int) Math.round((artistSimilarity * 0.70 + trackSimilarity * 0.30) * 100);

        List<String> commonArtistsList = commonArtists.stream().limit(10).collect(Collectors.toList());
        List<String> commonTracksList = commonTracks.stream().limit(10).collect(Collectors.toList());

        return new ComparisonDTO(
                user1.getUsername(),
                user2.getUsername(),
                finalScore,
                commonArtistsList,
                commonTracksList
        );
    }
}
