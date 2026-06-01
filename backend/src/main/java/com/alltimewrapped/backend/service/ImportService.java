package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.ImportResultResponse;
import com.alltimewrapped.backend.dto.SpotifyListeningDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.model.ListeningSource;
import com.alltimewrapped.backend.model.Track;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final TrackService trackService;
    private final AppUserRepository appUserRepository;
    private final ListeningRecordRepository listeningRecordRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @PersistenceContext
    private EntityManager entityManager;

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

        Map<String, Track> trackCache = new HashMap<>();
        Map<String, com.alltimewrapped.backend.model.Artist> artistCache = new HashMap<>();
        Map<String, com.alltimewrapped.backend.model.Album> albumCache = new HashMap<>();

        log.info("Pre-populating memory caches of tracks, artists, and albums...");
        trackService.prepopulateCaches(trackCache, artistCache, albumCache);
        entityManager.clear(); // Detach the ~59,000 entities from Hibernate L1 cache to disable dirty-checking scans
        log.info("Pre-population complete. Cached {} tracks, {} artists, and {} albums.",
                trackCache.size(), artistCache.size(), albumCache.size());

        log.info("Pre-loading existing listening records to avoid duplicate checks...");
        Set<String> existingKeys = buildExistingKeysSet(user.getId());
        log.info("Pre-loaded {} existing duplicate keys for user.", existingKeys.size());

        int totalFiles = countSpotifyAudioHistoryFiles(file);
        int currentFileIndex = 0;

        try (InputStream inputStream = file.getInputStream();
             ZipInputStream zipInputStream = new ZipInputStream(inputStream)) {

            ZipEntry entry;

            while ((entry = zipInputStream.getNextEntry()) != null) {
                String fileName = entry.getName();

                if (isSpotifyAudioHistoryFile(fileName)) {
                    log.info("Processing file: {}", fileName);

                    processedFiles++;
                    currentFileIndex++;

                    List<SpotifyListeningDTO> records = objectMapper.readValue(
                            zipInputStream,
                            new TypeReference<List<SpotifyListeningDTO>>() {}
                    );

                    log.info("Records found in {}: {}", fileName, records.size());

                    totalRecordsFound += records.size();

                    // Process the records directly using the shared caches and shared duplicate keys across all files
                    ImportResultResponse fileResult = processRecords(records, user, trackCache, artistCache, albumCache, existingKeys, currentFileIndex, totalFiles);

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

        // Send final completed status
        messagingTemplate.convertAndSend(
                "/topic/import-progress/" + userId,
                "{\"progress\": 100, \"status\": \"COMPLETED\", \"message\": \"Import completed successfully!\"}"
        );

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
        return (fileName.contains("Streaming_History_Audio") 
                || fileName.contains("StreamingHistory_music") 
                || fileName.contains("endsong"))
                && fileName.endsWith(".json")
                && !fileName.contains("__MACOSX")
                && !fileName.contains("/._")
                && !fileName.startsWith("._");
    }

    private int countSpotifyAudioHistoryFiles(MultipartFile file) {
        int count = 0;
        try (InputStream inputStream = file.getInputStream();
             ZipInputStream zipInputStream = new ZipInputStream(inputStream)) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                if (isSpotifyAudioHistoryFile(entry.getName())) {
                    count++;
                }
                zipInputStream.closeEntry();
            }
        } catch (Exception e) {
            log.error("Error counting files in ZIP: {}", e.getMessage());
        }
        return count > 0 ? count : 1;
    }

    // processes Spotify records and saves valid new records in batches
    @Transactional
    public ImportResultResponse processRecords(List<SpotifyListeningDTO> records, AppUser user) {
        Map<String, Track> trackCache = new HashMap<>();
        Map<String, com.alltimewrapped.backend.model.Artist> artistCache = new HashMap<>();
        Map<String, com.alltimewrapped.backend.model.Album> albumCache = new HashMap<>();

        trackService.prepopulateCaches(trackCache, artistCache, albumCache);
        entityManager.clear(); // Detach pre-populated entities from Hibernate L1 cache to disable dirty-checking scans
        Set<String> existingKeys = buildExistingKeysSet(user.getId());

        return processRecords(records, user, trackCache, artistCache, albumCache, existingKeys, 1, 1);
    }

    // Backward-compatible overloaded method
    @Transactional
    public ImportResultResponse processRecords(
            List<SpotifyListeningDTO> records,
            AppUser user,
            Map<String, Track> trackCache,
            Map<String, com.alltimewrapped.backend.model.Artist> artistCache,
            Map<String, com.alltimewrapped.backend.model.Album> albumCache
    ) {
        Set<String> existingKeys = buildExistingKeysSet(user.getId());
        return processRecords(records, user, trackCache, artistCache, albumCache, existingKeys, 1, 1);
    }

    // Backward-compatible overloaded method
    @Transactional
    public ImportResultResponse processRecords(
            List<SpotifyListeningDTO> records,
            AppUser user,
            Map<String, Track> trackCache,
            Map<String, com.alltimewrapped.backend.model.Artist> artistCache,
            Map<String, com.alltimewrapped.backend.model.Album> albumCache,
            Set<String> existingKeys
    ) {
        return processRecords(records, user, trackCache, artistCache, albumCache, existingKeys, 1, 1);
    }

    // Overloaded cache-sharing and duplicate-key-sharing version of processRecords for fast import
    @Transactional
    public ImportResultResponse processRecords(
            List<SpotifyListeningDTO> records,
            AppUser user,
            Map<String, Track> trackCache,
            Map<String, com.alltimewrapped.backend.model.Artist> artistCache,
            Map<String, com.alltimewrapped.backend.model.Album> albumCache,
            Set<String> existingKeys,
            int fileIndex,
            int totalFiles
    ) {
        int importedRecords = 0;
        int duplicateRecords = 0;
        int skippedRecords = 0;

        List<ListeningRecord> batch = new ArrayList<>();

        for (int i = 0; i < records.size(); i++) {
            SpotifyListeningDTO dto = records.get(i);

            // ignore records that cannot be used for music statistics
            if (shouldSkipRecord(dto)) {
                skippedRecords++;
                continue;
            }

            OffsetDateTime playedAt = null;
            String rawTs = dto.getTs() != null ? dto.getTs() : dto.getEndTime();
            if (rawTs == null) {
                skippedRecords++;
                continue;
            }

            try {
                if (rawTs.contains("T") || rawTs.contains("Z")) {
                    playedAt = OffsetDateTime.parse(rawTs);
                } else {
                    // standard format: "2024-05-19 12:45"
                    java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
                    java.time.LocalDateTime localDateTime = java.time.LocalDateTime.parse(rawTs.trim(), formatter);
                    playedAt = localDateTime.atOffset(java.time.ZoneOffset.UTC);
                }
            } catch (Exception exception) {
                skippedRecords++;
                continue;
            }

            String tName = dto.getMaster_metadata_track_name() != null ? dto.getMaster_metadata_track_name() : dto.getTrackName();
            String aName = dto.getMaster_metadata_album_artist_name() != null ? dto.getMaster_metadata_album_artist_name() : dto.getArtistName();
            String albName = dto.getMaster_metadata_album_album_name() != null ? dto.getMaster_metadata_album_album_name() : aName + " - Album";
            
            // Generate deterministic surrogate URI for standard format to leverage cache/duplicate index checks
            String trackUri = dto.getSpotify_track_uri();
            if (trackUri == null) {
                trackUri = "surrogate:" + java.util.UUID.nameUUIDFromBytes((aName.trim().toLowerCase() + ":" + tName.trim().toLowerCase()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
            }

            Track track = trackService.findOrCreateTrack(
                    trackUri,
                    tName,
                    aName,
                    albName,
                    trackCache,
                    artistCache,
                    albumCache
            );

            String duplicateKey = track.getId() + ":" + playedAt.toInstant().toEpochMilli();

            if (existingKeys.contains(duplicateKey)) {
                duplicateRecords++;
                continue;
            }

            // prevent duplicates inside the same import, before the records are saved
            existingKeys.add(duplicateKey);

            ListeningRecord record = buildRecord(dto, user, track, playedAt);
            batch.add(record);
            importedRecords++;

            if (batch.size() >= BATCH_SIZE) {
                saveBatch(batch);
                entityManager.flush();
                entityManager.clear();
            }

            // Send real-time progress updates every 250 records
            if (i % 250 == 0 || i == records.size() - 1) {
                double fileProgress = (double) (i + 1) / records.size();
                double globalProgress = ((fileIndex - 1) + fileProgress) / totalFiles;
                int progressPercent = (int) (globalProgress * 100);

                if (progressPercent >= 100 && fileIndex < totalFiles) {
                    progressPercent = 99;
                }

                messagingTemplate.convertAndSend(
                        "/topic/import-progress/" + user.getId(),
                        "{\"progress\": " + progressPercent + ", \"message\": \"Procesare fișier " + fileIndex + "/" + totalFiles + "...\"}"
                );
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
        String tName = dto.getMaster_metadata_track_name() != null ? dto.getMaster_metadata_track_name() : dto.getTrackName();
        String aName = dto.getMaster_metadata_album_artist_name() != null ? dto.getMaster_metadata_album_artist_name() : dto.getArtistName();
        Long ms = dto.getMs_played() != null ? dto.getMs_played() : dto.getMsPlayed();

        return (tName == null || tName.isBlank() || aName == null || aName.isBlank())
                || ms == null
                || ms == 0;
    }

    // saves the current batch of ListeningRecord entities using high-performance JdbcTemplate batch updates,
    // bypassing Hibernate's identity batch insert limitation.
    private void saveBatch(List<ListeningRecord> batch) {
        String sql = """
            INSERT INTO oltp.listening_records 
            (user_id, track_id, played_at, ms_played, source, skipped, platform, country_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """;

        jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                ListeningRecord r = batch.get(i);
                ps.setLong(1, r.getUser().getId());
                ps.setLong(2, r.getTrack().getId());
                ps.setObject(3, r.getPlayedAt());

                if (r.getMsPlayed() != null) {
                    ps.setLong(4, r.getMsPlayed());
                } else {
                    ps.setNull(4, Types.BIGINT);
                }

                ps.setString(5, r.getSource() != null ? r.getSource().name() : null);

                if (r.getSkipped() != null) {
                    ps.setBoolean(6, r.getSkipped());
                } else {
                    ps.setNull(6, Types.BOOLEAN);
                }

                ps.setString(7, r.getPlatform());
                ps.setString(8, r.getCountryCode());
            }

            @Override
            public int getBatchSize() {
                return batch.size();
            }
        });

        log.debug("Bulk inserted batch of {} records via JDBC", batch.size());
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
        record.setMsPlayed(dto.getMs_played() != null ? dto.getMs_played() : dto.getMsPlayed());
        record.setSource(ListeningSource.SPOTIFY);
        record.setSkipped(dto.getSkipped());
        record.setPlatform(dto.getPlatform() != null ? dto.getPlatform() : "Spotify (Imported)");
        record.setCountryCode(dto.getConn_country() != null ? dto.getConn_country() : "ZZ");

        return record;
    }

    // pre-loads all existing records for a user into a set
    // this avoids one duplicate-check query for every Spotify record
    private Set<String> buildExistingKeysSet(Long userId) {
        return listeningRecordRepository.findTrackIdAndPlayedAtByUserId(userId)
                .stream()
                .map(row -> {
                    long epochMs = 0L;
                    Object rawPlayedAt = row[1];

                    if (rawPlayedAt instanceof OffsetDateTime offsetDateTime) {
                        epochMs = offsetDateTime.toInstant().toEpochMilli();
                    } else if (rawPlayedAt instanceof java.sql.Timestamp timestamp) {
                        epochMs = timestamp.toInstant().toEpochMilli();
                    } else if (rawPlayedAt instanceof java.time.Instant instant) {
                        epochMs = instant.toEpochMilli();
                    }

                    return row[0] + ":" + epochMs;
                })
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));
    }
}