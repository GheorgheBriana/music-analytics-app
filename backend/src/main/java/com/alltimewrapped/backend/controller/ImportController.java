package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ListeningRecordDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;
    private final AppUserRepository appUserRepository;

    @PostMapping
    public String importData(@RequestBody List<ListeningRecordDTO> records) {
        AppUser user = appUserRepository.findById(2L)
                .orElseThrow(() -> new RuntimeException("Test user not found"));

        importService.importRecords(user, records);

        return "Imported successfully!";
    }

    @PostMapping("/spotify-zip")
    public String importSpotifyZip(@RequestParam("file") MultipartFile file) {
        return importService.importSpotifyZip(file);
    }
}