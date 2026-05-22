package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwFactListeningEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DwFactListeningEventRepository extends JpaRepository<DwFactListeningEvent, Long> {

    @Query("SELECT COUNT(f) FROM DwFactListeningEvent f WHERE f.user.userKey = :userKey")
    long countByUserKey(@Param("userKey") Long userKey);

    boolean existsByOriginalListeningRecordId(Long originalListeningRecordId);
}