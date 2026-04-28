package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ListeningRecordRequest;
import com.alltimewrapped.backend.dto.ListeningRecordResponse;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.ListeningSource;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ListeningRecordService {

    private final ListeningRecordRepository listeningRecordRepository;
    private final TrackService trackService;
    private final AppUserRepository appUserRepository;

    // creates a listening record starting from the request received from the controller
    public ListeningRecordResponse createFromRequest(ListeningRecordRequest request) {
        Track track = trackService.findOrCreateTrack(
                request.getSpotifyTrackUri(),
                request.getTrackName(),
                request.getArtistName(),
                request.getAlbumName()
        );

        AppUser user = appUserRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        ListeningRecord savedRecord = saveListeningRecord(
                user,
                track,
                request.getPlayedAt(),
                request.getMsPlayed(),
                request.getSource(),
                request.getSkipped(),
                request.getPlatform(),
                request.getCountryCode()
        );

        return mapToResponse(savedRecord);
    }

    // saves a listening record for a user
    public ListeningRecord saveListeningRecord(
            AppUser user,
            Track track,
            OffsetDateTime playedAt,
            Long msPlayed,
            ListeningSource source,
            Boolean skipped,
            String platform,
            String countryCode
    ) {
        ListeningRecord listeningRecord = new ListeningRecord();

        listeningRecord.setUser(user);
        listeningRecord.setTrack(track);
        listeningRecord.setPlayedAt(playedAt);
        listeningRecord.setMsPlayed(msPlayed);
        listeningRecord.setSource(source);
        listeningRecord.setSkipped(skipped);
        listeningRecord.setPlatform(platform);
        listeningRecord.setCountryCode(countryCode);

        return listeningRecordRepository.save(listeningRecord);
    }

    public List<ListeningRecordResponse> getListeningRecordsByUserId(Long userId) {
        return listeningRecordRepository.findByUserId(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private ListeningRecordResponse mapToResponse(ListeningRecord record) {
        return new ListeningRecordResponse(
                record.getId(),
                record.getTrack().getTrackName(),
                record.getTrack().getArtistName(),
                record.getTrack().getAlbumName(),
                record.getPlayedAt(),
                record.getMsPlayed(),
                record.getSource().name(),
                record.getSkipped(),
                record.getPlatform(),
                record.getCountryCode()
        );
    }
}