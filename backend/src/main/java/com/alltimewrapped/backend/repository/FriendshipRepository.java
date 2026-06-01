package com.alltimewrapped.backend.repository;

import com.alltimewrapped.backend.model.Friendship;
import com.alltimewrapped.backend.model.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    // Caută relația dintre doi useri (în orice direcție)
    @Query("""
        SELECT f FROM Friendship f
        WHERE (f.requester.id = :u1 AND f.addressee.id = :u2)
           OR (f.requester.id = :u2 AND f.addressee.id = :u1)
        """)
    Optional<Friendship> findRelationBetween(@Param("u1") Long u1, @Param("u2") Long u2);

    // Toți prietenii ACCEPTED (în orice direcție)
    @Query("""
        SELECT f FROM Friendship f
        WHERE f.status = 'ACCEPTED'
          AND (f.requester.id = :userId OR f.addressee.id = :userId)
        """)
    List<Friendship> findAcceptedFriendships(@Param("userId") Long userId);

    // Requesturi primite (PENDING unde userul e addressee)
    List<Friendship> findByAddressee_IdAndStatus(Long addresseeId, FriendshipStatus status);

    // Requesturi trimise (PENDING unde userul e requester)
    List<Friendship> findByRequester_IdAndStatus(Long requesterId, FriendshipStatus status);

    // Verificare rapidă: sunt prieteni?
    @Query("""
        SELECT COUNT(f) > 0 FROM Friendship f
        WHERE f.status = 'ACCEPTED'
          AND ((f.requester.id = :u1 AND f.addressee.id = :u2)
            OR (f.requester.id = :u2 AND f.addressee.id = :u1))
        """)
    boolean areFriends(@Param("u1") Long u1, @Param("u2") Long u2);
}
