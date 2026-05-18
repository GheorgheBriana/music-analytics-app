package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwFactListeningEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DwFactListeningEventRepository extends JpaRepository<DwFactListeningEvent, Long> {

    boolean existsByOriginalListeningRecordId(Long originalListeningRecordId);
}