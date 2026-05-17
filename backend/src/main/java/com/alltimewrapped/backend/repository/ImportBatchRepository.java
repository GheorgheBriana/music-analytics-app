package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.model.ImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {

    List<ImportBatch> findByUserIdOrderByImportStartedAtDesc(Long userId);
}