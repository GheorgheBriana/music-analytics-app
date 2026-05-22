package com.alltimewrapped.backend.admin.repository;

import com.alltimewrapped.backend.admin.model.AdminActionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminActionLogRepository extends JpaRepository<AdminActionLog, Long> {
    List<AdminActionLog> findTop10ByOrderByCreatedAtDesc();
}
