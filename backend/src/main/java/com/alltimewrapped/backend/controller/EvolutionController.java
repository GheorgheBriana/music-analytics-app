package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.EvolutionResponse;
import com.alltimewrapped.backend.service.TasteEvolutionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/evolution")
@RequiredArgsConstructor
public class EvolutionController {

    private final TasteEvolutionService tasteEvolutionService;

    @GetMapping("/user/{userId}")
    public EvolutionResponse getEvolution(@PathVariable Long userId) {
        return tasteEvolutionService.getEvolution(userId);
    }
}
