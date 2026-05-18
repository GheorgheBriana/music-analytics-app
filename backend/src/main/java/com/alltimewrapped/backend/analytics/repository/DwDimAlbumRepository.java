package com.alltimewrapped.backend.analytics.repository;

import com.alltimewrapped.backend.analytics.model.DwDimAlbum;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DwDimAlbumRepository extends JpaRepository<DwDimAlbum, Long> {

    Optional<DwDimAlbum> findByOriginalAlbumId(Long originalAlbumId);
}