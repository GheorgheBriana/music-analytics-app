package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimArtist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimArtistRepository extends JpaRepository<DwDimArtist, Long> {

    Optional<DwDimArtist> findByOriginalArtistId(Long originalArtistId);
}