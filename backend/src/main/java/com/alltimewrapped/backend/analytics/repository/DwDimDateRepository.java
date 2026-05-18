package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimDate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DwDimDateRepository extends JpaRepository<DwDimDate, Long> {

    Optional<DwDimDate> findByFullDate(LocalDate fullDate);
}