package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ImportResultResponse;
import com.alltimewrapped.backend.dto.SpotifyListeningDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.ListeningSource;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonParser;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final TrackService trackService;
    private final AppUserRepository appUserRepository;
    private final ListeningRecordRepository listeningRecordRepository;

    private final ObjectMapper objectMapper = createObjectMapper();

    private static final int BATCH_SIZE = 500;

    // creates an object mapper that does not close the ZIP stream automatically
    private ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.getFactory().configure(JsonParser.Feature.AUTO_CLOSE_SOURCE, false);
        return mapper;
    }

    // imports Spotify listening history from a ZIP file
    @Transactional
    public ImportResultResponse importSpotifyZip(MultipartFile file, Long userId) {

        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User not found with id: " + userId
                ));

        int processedFiles = 0;
        int totalRecordsFound = 0;
        int importedRecords = 0;
        int duplicateRecords = 0;
        int skippedRecords = 0;

        try (InputStream inputStream = file.getInputStream();
             ZipInputStream zipInputStream = new ZipInputStream(inputStream)) {

            ZipEntry entry;

            while ((entry = zipInputStream.getNextEntry()) != null) {
                String fileName = entry.getName();

                if (isSpotifyAudioHistoryFile(fileName)) {
                    log.info("Processing file: {}", fileName);

                    processedFiles++;

                    List<SpotifyListeningDTO> records = objectMapper.readValue(
                            zipInputStream,
                            new TypeReference<List<SpotifyListeningDTO>>() {}
                    );

                    log.info("Records found in {}: {}", fileName, records.size());

                    totalRecordsFound += records.size();

                    // Process the records directly because the application currently runs without RabbitMQ.
                    ImportResultResponse fileResult = processRecords(records, user);

                    importedRecords += fileResult.getImportedRecords();
                    duplicateRecords += fileResult.getDuplicateRecords();
                    skippedRecords += fileResult.getSkippedRecords();
                }

                zipInputStream.closeEntry();
            }

        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Error processing Spotify ZIP: {}", exception.getMessage(), exception);

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Error processing ZIP file"
            );
        }

        log.info(
                "Import finished. Files processed: {}, total records found: {}, imported: {}, duplicates: {}, skipped: {}",
                processedFiles,
                totalRecordsFound,
                importedRecords,
                duplicateRecords,
                skippedRecords
        );

        return new ImportResultResponse(
                processedFiles,
                totalRecordsFound,
                importedRecords,
                duplicateRecords,
                skippedRecords
        );
    }

    private List<List<SpotifyListeningDTO>> createBatches(List<SpotifyListeningDTO> list, int batchSize) {
        List<List<SpotifyListeningDTO>> batches = new ArrayList<>();
        for (int i = 0; i < list.size(); i += batchSize) {
            batches.add(new ArrayList<>(
                    list.subList(i, Math.min(list.size(), i + batchSize)))
            );
        }
        return batches;
    }

    // checks if the current file is a Spotify audio history JSON file
    private boolean isSpotifyAudioHistoryFile(String fileName) {
        return fileName.contains("Streaming_History_Audio")
                && fileName.endsWith(".json");
    }

    // processes Spotify records and saves valid new records in batches
    @Transactional
    public ImportResultResponse processRecords(List<SpotifyListeningDTO> records, AppUser user) {
        int importedRecords = 0;
        int duplicateRecords = 0;
        int skippedRecords = 0;

        List<ListeningRecord> batch = new ArrayList<>();

        for (SpotifyListeningDTO dto : records) {

            // Ignore records that cannot be used for music statistics.
            if (shouldSkipRecord(dto)) {
                skippedRecords++;
                continue;
            }

            OffsetDateTime playedAt;

            try {
                playedAt = OffsetDateTime.parse(dto.getTs());
            } catch (Exception exception) {
                skippedRecords++;
                continue;
            }

            Track track = trackService.findOrCreateTrack(
                    dto.getSpotify_track_uri(),
                    dto.getMaster_metadata_track_name(),
                    dto.getMaster_metadata_album_artist_name(),
                    dto.getMaster_metadata_album_album_name()
            );

            if (isDuplicateRecord(user, track, playedAt)) {
                duplicateRecords++;
                continue;
            }

            ListeningRecord record = buildRecord(dto, user, track, playedAt);
            batch.add(record);
            importedRecords++;

            if (batch.size() >= BATCH_SIZE) {
                saveBatch(batch);
            }
        }

        if (!batch.isEmpty()) {
            saveBatch(batch);
        }

        return new ImportResultResponse(
                0,
                records.size(),
                importedRecords,
                duplicateRecords,
                skippedRecords
        );
    }

    // skips records that are not useful for music statistics
    private boolean shouldSkipRecord(SpotifyListeningDTO dto) {
        return dto.getSpotify_track_uri() == null
                || dto.getMs_played() == null
                || dto.getMs_played() == 0;
    }

    // saves the current batch and prepares it for the next records
    private void saveBatch(List<ListeningRecord> batch) {
        listeningRecordRepository.saveAll(batch);
        log.debug("Saved batch of {} records", batch.size());
        batch.clear();
    }

    // builds a listening record without saving it immediately
    private ListeningRecord buildRecord(
            SpotifyListeningDTO dto,
            AppUser user,
            Track track,
            OffsetDateTime playedAt
    ) {
        ListeningRecord record = new ListeningRecord();

        record.setUser(user);
        record.setTrack(track);
        record.setPlayedAt(playedAt);
        record.setMsPlayed(dto.getMs_played());
        record.setSource(ListeningSource.SPOTIFY);
        record.setSkipped(dto.getSkipped());
        record.setPlatform(dto.getPlatform());
        record.setCountryCode(dto.getConn_country());

        return record;
    }

    // checks if the listening record was already imported
    private boolean isDuplicateRecord(AppUser user, Track track, OffsetDateTime playedAt) {
        return listeningRecordRepository.existsByUserIdAndTrackIdAndPlayedAt(
                user.getId(),
                track.getId(),
                playedAt
        );
    }
}