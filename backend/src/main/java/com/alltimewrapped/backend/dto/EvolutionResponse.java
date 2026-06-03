package com.alltimewrapped.backend.dto;

import java.util.List;

public record EvolutionResponse(
    boolean hasEnoughData,
    String message,
    int monthsCount,
    String firstMonth,
    String lastMonth,
    List<GenreStream> streams,
    List<TasteShift> volatility,
    List<TasteShift> turningPoints,
    List<StoryCard> cards,
    List<GenreProjection> projections
) {}
