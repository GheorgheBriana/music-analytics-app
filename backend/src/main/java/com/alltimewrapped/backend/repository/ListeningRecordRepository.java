package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.ListeningRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ListeningRecordRepository extends JpaRepository<ListeningRecord, Long> {

    List<ListeningRecord> findByUser(AppUser user);

    List<ListeningRecord> findByUserId(Long userId);

    List<ListeningRecord> findByUserOrderByPlayedAtDesc(AppUser user);
}