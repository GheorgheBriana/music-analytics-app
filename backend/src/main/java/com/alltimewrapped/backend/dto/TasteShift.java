package com.alltimewrapped.backend.dto;

public record TasteShift(
    String fromMonth,
    String toMonth,
    int monthIndex,
    double distance,
    boolean isTurningPoint
) {}
