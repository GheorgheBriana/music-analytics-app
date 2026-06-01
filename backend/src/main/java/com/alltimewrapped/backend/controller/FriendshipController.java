package com.alltimewrapped.backend.controller;

import com.alltimewrapped.backend.dto.*;
import com.alltimewrapped.backend.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendshipController {

    private final FriendshipService friendshipService;

    @GetMapping
    public List<FriendDTO> getMyFriends(@RequestHeader("X-User-Id") Long userId) {
        return friendshipService.getFriends(userId);
    }

    @GetMapping("/requests/incoming")
    public List<FriendRequestDTO> getIncoming(@RequestHeader("X-User-Id") Long userId) {
        return friendshipService.getIncomingRequests(userId);
    }

    @GetMapping("/requests/outgoing")
    public List<FriendRequestDTO> getOutgoing(@RequestHeader("X-User-Id") Long userId) {
        return friendshipService.getOutgoingRequests(userId);
    }

    @GetMapping("/search")
    public List<UserSearchDTO> search(@RequestHeader("X-User-Id") Long userId,
                                      @RequestParam("q") String query) {
        return friendshipService.searchUsers(query, userId);
    }

    @PostMapping("/request")
    public FriendRequestDTO sendRequest(@RequestHeader("X-User-Id") Long userId,
                                        @RequestBody Map<String, Long> body) {
        Long toUserId = body.get("toUserId");
        return friendshipService.sendRequest(userId, toUserId);
    }

    @PutMapping("/request/{id}/accept")
    public void accept(@RequestHeader("X-User-Id") Long userId, @PathVariable Long id) {
        friendshipService.acceptRequest(id, userId);
    }

    @PutMapping("/request/{id}/reject")
    public void reject(@RequestHeader("X-User-Id") Long userId, @PathVariable Long id) {
        friendshipService.rejectRequest(id, userId);
    }

    @DeleteMapping("/request/{id}")
    public void cancel(@RequestHeader("X-User-Id") Long userId, @PathVariable Long id) {
        friendshipService.cancelRequest(id, userId);
    }

    @DeleteMapping("/{otherUserId}")
    public void unfriend(@RequestHeader("X-User-Id") Long userId, @PathVariable Long otherUserId) {
        friendshipService.removeFriend(userId, otherUserId);
    }
}
