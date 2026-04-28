package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ListeningRecordDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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

    public String importSpotifyZip(MultipartFile file) {
        try (InputStream is = file.getInputStream();
             ZipInputStream zis = new ZipInputStream(is)) {

            ZipEntry entry;

            while ((entry = zis.getNextEntry()) != null) {
                String fileName = entry.getName();

                if (fileName.endsWith(".json")) {
                    System.out.println("Found JSON file: " + fileName);
                }
            }

            return "ZIP processed successfully";

        } catch (Exception e) {
            e.printStackTrace();
            return "Error processing ZIP";
        }
    }
}