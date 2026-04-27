package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.TrackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TrackService {

    private final TrackRepository trackRepository;

    // finds an existing track or creates a new one if it doesn't exist
    public Track findOrCreateTrack(String spotifyTrackUri, String trackName, String artistName, String albumName) {
        if (spotifyTrackUri != null) {
            return trackRepository.findBySpotifyTrackUri(spotifyTrackUri)
                    .orElseGet(() -> createTrack(spotifyTrackUri, trackName, artistName, albumName));
        }

        return createTrack(null, trackName, artistName, albumName);
    }

    // creates and saves a new track
    private Track createTrack(String spotifyTrackUri, String trackName, String artistName, String albumName) {

        // create new track object
        Track track = new Track();

        // set track details
        track.setSpotifyTrackUri(spotifyTrackUri);
        track.setTrackName(trackName);
        track.setArtistName(artistName);
        track.setAlbumName(albumName);

        return trackRepository.save(track);
    }
}
