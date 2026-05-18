package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimPlatform;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimPlatformRepository extends JpaRepository<DwDimPlatform, Long> {

    Optional<DwDimPlatform> findByPlatformNameIgnoreCase(String platformName);
}