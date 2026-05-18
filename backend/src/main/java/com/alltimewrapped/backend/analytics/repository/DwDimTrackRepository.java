package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimTrack;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimTrackRepository extends JpaRepository<DwDimTrack, Long> {

    Optional<DwDimTrack> findByOriginalTrackId(Long originalTrackId);
}