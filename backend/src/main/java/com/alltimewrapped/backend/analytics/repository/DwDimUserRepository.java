package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimUserRepository extends JpaRepository<DwDimUser, Long> {

    Optional<DwDimUser> findByOriginalUserId(Long originalUserId);
}