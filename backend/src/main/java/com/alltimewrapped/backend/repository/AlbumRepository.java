package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.model.Album;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AlbumRepository extends JpaRepository<Album, Long> {

    Optional<Album> findByAlbumNameIgnoreCase(String albumName);
}