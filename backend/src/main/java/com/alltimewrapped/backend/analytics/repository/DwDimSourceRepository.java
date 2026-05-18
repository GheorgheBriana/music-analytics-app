package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimSourceRepository extends JpaRepository<DwDimSource, Long> {

    Optional<DwDimSource> findBySourceNameIgnoreCase(String sourceName);
}