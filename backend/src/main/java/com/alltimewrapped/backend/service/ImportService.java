package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ListeningRecordDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ImportService {

    private final TrackService trackService;
    private final ListeningRecordService listeningRecordService;

    public void importRecords(AppUser user, List<ListeningRecordDTO> records) {
        for (ListeningRecordDTO record : records) {
            var track = trackService.findOrCreateTrack(
                    record.getSpotifyTrackUri(),
                    record.getTrackName(),
                    record.getArtistName(),
                    record.getAlbumName()
            );

            listeningRecordService.saveListeningRecord(
                    user,
                    track,
                    OffsetDateTime.parse(record.getPlayedAt()),
                    record.getMsPlayed(),
                    ListeningSource.SPOTIFY,
                    record.getSkipped(),
                    record.getPlatform(),
                    record.getCountryCode()
            );
        }
    }
}