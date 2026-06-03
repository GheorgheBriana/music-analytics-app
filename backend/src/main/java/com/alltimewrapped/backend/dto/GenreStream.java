package com.alltimewrapped.backend.dto;

import java.util.List;

public record GenreStream(
    String genreName,
    List<Double> data
) {}
