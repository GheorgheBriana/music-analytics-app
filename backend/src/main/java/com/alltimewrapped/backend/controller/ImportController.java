package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ImportResultResponse;
import com.alltimewrapped.backend.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping("/spotify-zip")
    public ResponseEntity<ImportResultResponse> importSpotifyZip(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") Long userId
    ) {
        ImportResultResponse result = importService.importSpotifyZip(file, userId);
        return ResponseEntity.ok(result);
    }
}