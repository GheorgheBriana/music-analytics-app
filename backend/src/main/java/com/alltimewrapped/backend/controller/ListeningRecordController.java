package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.ListeningRecordRequest;
import com.alltimewrapped.backend.dto.ListeningRecordResponse;
import com.alltimewrapped.backend.service.ListeningRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/listening-records")
public class ListeningRecordController {

    private final ListeningRecordService listeningRecordService;

    @PostMapping
    public ListeningRecordResponse createListeningRecord(@RequestBody ListeningRecordRequest request) {
        return listeningRecordService.createFromRequest(request);
    }

    @GetMapping("/user/{userId}")
    public List<ListeningRecordResponse> getListeningRecordsByUser(@PathVariable Long userId) {
        return listeningRecordService.getListeningRecordsByUserId(userId);
    }
}