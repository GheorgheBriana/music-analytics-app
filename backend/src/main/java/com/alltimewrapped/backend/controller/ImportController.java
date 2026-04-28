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

    @PostMapping("/spotify-zip")
    public String importSpotifyZip(@RequestParam("file") MultipartFile file) {

        AppUser user = appUserRepository.findById(2L)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return importService.importSpotifyZip(file, user);
    }
}