package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.model.Artist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Long> {

    Optional<Artist> findByArtistNameIgnoreCase(String artistName);

    long countByGenreEnrichedTrue();

    org.springframework.data.domain.Page<Artist> findByGenreEnrichedFalse(org.springframework.data.domain.Pageable pageable);
}