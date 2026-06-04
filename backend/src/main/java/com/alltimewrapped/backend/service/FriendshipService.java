package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.model.*;
import com.alltimewrapped.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final AppUserRepository appUserRepository;
    private final SystemSettingsService systemSettingsService;
    private final JdbcTemplate jdbcTemplate;

    // ===== SEND REQUEST =====
    @Transactional
    public FriendRequestDTO sendRequest(Long fromUserId, Long toUserId) {
        if (!systemSettingsService.isFriendingEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, 
                "Friend requests are currently disabled by the administrator");
        }
        if (fromUserId.equals(toUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                "Cannot send friend request to yourself");
        }
        AppUser requester = appUserRepository.findById(fromUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requester not found"));
        AppUser addressee = appUserRepository.findById(toUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Addressee not found"));

        if (addressee.getRole() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot send friend requests to an administrator");
        }

        Optional<Friendship> existing = friendshipRepository.findRelationBetween(fromUserId, toUserId);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Already friends");
            }
            if (f.getStatus() == FriendshipStatus.PENDING) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Request already pending");
            }
            if (f.getStatus() == FriendshipStatus.BLOCKED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot send request to this user");
            }
            // Dacă era REJECTED, ștergem și creăm unul nou
            friendshipRepository.delete(f);
        }

        Friendship newRequest = Friendship.builder()
            .requester(requester)
            .addressee(addressee)
            .status(FriendshipStatus.PENDING)
            .createdAt(OffsetDateTime.now())
            .build();

        Friendship saved = friendshipRepository.save(newRequest);
        return toRequestDTO(saved, fromUserId);
    }

    // ===== ACCEPT REQUEST =====
    @Transactional
    public void acceptRequest(Long requestId, Long currentUserId) {
        Friendship f = friendshipRepository.findById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        
        if (!f.getAddressee().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the addressee of this request");
        }
        if (f.getStatus() != FriendshipStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }
        
        f.setStatus(FriendshipStatus.ACCEPTED);
        f.setRespondedAt(OffsetDateTime.now());
        friendshipRepository.save(f);
    }

    // ===== REJECT REQUEST =====
    @Transactional
    public void rejectRequest(Long requestId, Long currentUserId) {
        Friendship f = friendshipRepository.findById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        
        if (!f.getAddressee().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the addressee");
        }
        if (f.getStatus() != FriendshipStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }
        
        f.setStatus(FriendshipStatus.REJECTED);
        f.setRespondedAt(OffsetDateTime.now());
        friendshipRepository.save(f);
    }

    // ===== CANCEL OUTGOING REQUEST =====
    @Transactional
    public void cancelRequest(Long requestId, Long currentUserId) {
        Friendship f = friendshipRepository.findById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        
        if (!f.getRequester().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the requester");
        }
        if (f.getStatus() != FriendshipStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        }
        friendshipRepository.delete(f);
    }

    // ===== UNFRIEND =====
    @Transactional
    public void removeFriend(Long userId1, Long userId2) {
        Friendship f = friendshipRepository.findRelationBetween(userId1, userId2)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not friends"));
        if (f.getStatus() != FriendshipStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not currently friends");
        }
        friendshipRepository.delete(f);
    }

    // ===== GET MY FRIENDS =====
    @Transactional(readOnly = true)
    public List<FriendDTO> getFriends(Long userId) {
        return friendshipRepository.findAcceptedFriendships(userId).stream()
            .map(f -> {
                AppUser other = f.getRequester().getId().equals(userId) ? f.getAddressee() : f.getRequester();
                String bio = null;
                String favGenre = null;
                String avatarUrl = null;
                try {
                    java.util.Map<String, Object> data = jdbcTemplate.queryForMap(
                        "SELECT bio, favorite_genre, avatar_url FROM oltp.user_profile_data WHERE user_id = ?",
                        other.getId()
                    );
                    bio = (String) data.get("bio");
                    favGenre = (String) data.get("favorite_genre");
                    avatarUrl = (String) data.get("avatar_url");
                } catch (Exception e) {
                    // Profile data does not exist yet
                }
                return new FriendDTO(other.getId(), other.getUsername(), f.getRespondedAt(), favGenre, avatarUrl, bio);
            })
            .toList();
    }

    // ===== INCOMING PENDING REQUESTS =====
    @Transactional(readOnly = true)
    public List<FriendRequestDTO> getIncomingRequests(Long userId) {
        return friendshipRepository.findByAddressee_IdAndStatus(userId, FriendshipStatus.PENDING).stream()
            .map(f -> new FriendRequestDTO(
                f.getId(),
                f.getRequester().getId(),
                f.getRequester().getUsername(),
                f.getCreatedAt(),
                "INCOMING"
            ))
            .toList();
    }

    // ===== OUTGOING PENDING REQUESTS =====
    @Transactional(readOnly = true)
    public List<FriendRequestDTO> getOutgoingRequests(Long userId) {
        return friendshipRepository.findByRequester_IdAndStatus(userId, FriendshipStatus.PENDING).stream()
            .map(f -> new FriendRequestDTO(
                f.getId(),
                f.getAddressee().getId(),
                f.getAddressee().getUsername(),
                f.getCreatedAt(),
                "OUTGOING"
            ))
            .toList();
    }

    // ===== SEARCH USERS WITH FRIENDSHIP STATUS =====
    @Transactional(readOnly = true)
    public List<UserSearchDTO> searchUsers(String query, Long currentUserId) {
        if (query == null || query.trim().length() < 2) return List.of();

        return appUserRepository.findAll().stream()
            .filter(u -> !u.getId().equals(currentUserId))
            .filter(u -> u.getRole() != UserRole.ADMIN)
            .filter(u -> u.getUsername() != null && 
                         u.getUsername().toLowerCase().contains(query.toLowerCase().trim()))
            .limit(20)
            .map(u -> {
                String status = computeFriendshipStatus(currentUserId, u.getId());
                String bio = null;
                String favGenre = null;
                String avatarUrl = null;
                try {
                    java.util.Map<String, Object> data = jdbcTemplate.queryForMap(
                        "SELECT bio, favorite_genre, avatar_url FROM oltp.user_profile_data WHERE user_id = ?",
                        u.getId()
                    );
                    bio = (String) data.get("bio");
                    favGenre = (String) data.get("favorite_genre");
                    avatarUrl = (String) data.get("avatar_url");
                } catch (Exception e) {
                    // Profile data does not exist yet
                }
                return new UserSearchDTO(u.getId(), u.getUsername(), status, avatarUrl, favGenre, bio);
            })
            .toList();
    }

    private String computeFriendshipStatus(Long currentUserId, Long otherUserId) {
        Optional<Friendship> rel = friendshipRepository.findRelationBetween(currentUserId, otherUserId);
        if (rel.isEmpty()) return "NONE";
        
        Friendship f = rel.get();
        if (f.getStatus() == FriendshipStatus.ACCEPTED) return "FRIENDS";
        if (f.getStatus() == FriendshipStatus.BLOCKED) return "BLOCKED";
        if (f.getStatus() == FriendshipStatus.REJECTED) return "REJECTED";
        // PENDING — verifică direcția
        return f.getRequester().getId().equals(currentUserId) ? "PENDING_OUTGOING" : "PENDING_INCOMING";
    }

    // ===== ARE FRIENDS? (used by SocialService) =====
    @Transactional(readOnly = true)
    public boolean areFriends(Long u1, Long u2) {
        return friendshipRepository.areFriends(u1, u2);
    }

    private FriendRequestDTO toRequestDTO(Friendship f, Long currentUserId) {
        AppUser other = f.getRequester().getId().equals(currentUserId) ? f.getAddressee() : f.getRequester();
        String direction = f.getRequester().getId().equals(currentUserId) ? "OUTGOING" : "INCOMING";
        return new FriendRequestDTO(f.getId(), other.getId(), other.getUsername(), f.getCreatedAt(), direction);
    }
}
