package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimGenre;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimGenreRepository extends JpaRepository<DwDimGenre, Long> {

    Optional<DwDimGenre> findByOriginalGenreId(Long originalGenreId);
}