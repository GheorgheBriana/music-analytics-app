package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.ListeningSource;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListeningRecordService {
    private final ListeningRecordRepository listeningRecordRepository;

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
        // create object
        ListeningRecord listeningRecord = new ListeningRecord();

        // add values
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

    public List<ListeningRecord> getListeningRecordsByUserId(Long userId) {
        return listeningRecordRepository.findByUserId(userId);
    }
}
