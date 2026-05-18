package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimTime;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimTimeRepository extends JpaRepository<DwDimTime, Long> {

    Optional<DwDimTime> findByHourAndMinute(Integer hour, Integer minute);
}