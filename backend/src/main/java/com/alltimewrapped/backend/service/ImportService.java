package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.SpotifyListeningDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningSource;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String importSpotifyZip(MultipartFile file, AppUser user) {
        try (InputStream is = file.getInputStream();
             ZipInputStream zis = new ZipInputStream(is)) {

            ZipEntry entry;

            int importedCount = 0;
            int maxImportLimit = 1000;

            while ((entry = zis.getNextEntry()) != null) {
                String fileName = entry.getName();

                if (fileName.contains("Streaming_History_Audio") && fileName.endsWith(".json")) {
                    System.out.println("Processing file: " + fileName);

                    List<SpotifyListeningDTO> records = objectMapper.readValue(
                            zis,
                            new TypeReference<List<SpotifyListeningDTO>>() {}
                    );

                    System.out.println("Records in file: " + records.size());

                    for (SpotifyListeningDTO dto : records) {

                        if (importedCount >= maxImportLimit) {
                            return "Imported test limit: " + importedCount + " records";
                        }

                        if (dto.getSpotify_track_uri() == null) {
                            continue;
                        }

                        var track = trackService.findOrCreateTrack(
                                dto.getSpotify_track_uri(),
                                dto.getMaster_metadata_track_name(),
                                dto.getMaster_metadata_album_artist_name(),
                                dto.getMaster_metadata_album_album_name()
                        );

                        listeningRecordService.saveListeningRecord(
                                user,
                                track,
                                OffsetDateTime.parse(dto.getTs()),
                                dto.getMs_played(),
                                ListeningSource.SPOTIFY,
                                dto.getSkipped(),
                                dto.getPlatform(),
                                dto.getConn_country()
                        );

                        importedCount++;
                    }

                    return "Imported test limit: " + importedCount + " records";
                }
            }

            return "Spotify data imported successfully!";

        } catch (Exception e) {
            e.printStackTrace();
            return "Error processing ZIP";
        }
    }
}