package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ListeningRecordRequest;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.service.ListeningRecordService;
import com.alltimewrapped.backend.service.TrackService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("api/listening-records")
class ListeningRecordController {

    private final ListeningRecordService listeningRecordService;
    private final TrackService trackService;
    private final AppUserRepository appUserRepository;

    @PostMapping
    public ListeningRecord createListeningRecord(@RequestBody ListeningRecordRequest request) {
        Track track = trackService.findOrCreateTrack(
                request.getSpotifyTrackUri(),
                request.getTrackName(),
                request.getArtistName(),
                request.getAlbumName()
        );

        // take user from database by Id
        AppUser user = appUserRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return listeningRecordService.saveListeningRecord(
                user,
                track,
                request.getPlayedAt(),
                request.getMsPlayed(),
                request.getSource(),
                request.getSkipped(),
                request.getPlatform(),
                request.getCountryCode()
        );
    }

}
