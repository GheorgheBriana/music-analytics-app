package com.alltimewrapped.backend;

import com.alltimewrapped.backend.dto.FriendDTO;
import com.alltimewrapped.backend.dto.FriendRequestDTO;
import com.alltimewrapped.backend.dto.UserSearchDTO;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.model.UserRole;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.service.FriendshipService;
import com.alltimewrapped.backend.service.SocialService;
import com.alltimewrapped.backend.service.SystemSettingsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class FriendshipServiceTests {

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private SystemSettingsService systemSettingsService;

    @Autowired
    private SocialService socialService;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private AppUser user1;
    private AppUser user2;
    private AppUser user3;

    @BeforeEach
    void setUp() {
        // Clean up database tables for clean test executions
        jdbcTemplate.execute("DELETE FROM oltp.friendships");
        jdbcTemplate.execute("DELETE FROM oltp.app_users WHERE username LIKE 'test_friend_%'");

        // Create 3 clean test users
        user1 = appUserRepository.save(AppUser.builder()
                .username("test_friend_1")
                .email("tf1@test.com")
                .role(UserRole.USER)
                .build());

        user2 = appUserRepository.save(AppUser.builder()
                .username("test_friend_2")
                .email("tf2@test.com")
                .role(UserRole.USER)
                .build());

        user3 = appUserRepository.save(AppUser.builder()
                .username("test_friend_3")
                .email("tf3@test.com")
                .role(UserRole.USER)
                .build());
    }

    @AfterEach
    void tearDown() {
        // Reset system setting back to true just in case
        systemSettingsService.setFriendingEnabled(true, null);

        // Clean up users and friendships
        jdbcTemplate.execute("DELETE FROM oltp.friendships");
        jdbcTemplate.execute("DELETE FROM oltp.app_users WHERE username LIKE 'test_friend_%'");
    }

    @Test
    void testFriendshipLifecycleAndPrivacyGate() {
        System.out.println("--- Starting Friendship Lifecycle Test ---");

        // 1. Initial State: They are not friends, should return NONE in status check
        List<UserSearchDTO> searchBefore = friendshipService.searchUsers("test_friend_2", user1.getId());
        assertEquals(1, searchBefore.size());
        assertEquals("NONE", searchBefore.get(0).getFriendshipStatus());

        // 2. Privacy Gate: Compare should throw FORBIDDEN since they are not friends
        assertThrows(ResponseStatusException.class, () -> {
            socialService.compareUsers(user1.getId(), user2.getId());
        }, "Should deny profile comparison if not friends");

        // 3. Send Friend Request: User 1 sends request to User 2
        FriendRequestDTO request = friendshipService.sendRequest(user1.getId(), user2.getId());
        assertNotNull(request);
        assertEquals("OUTGOING", request.getDirection());
        assertEquals(user2.getUsername(), request.getOtherUsername());

        // Check list sizes
        List<FriendRequestDTO> outgoingList = friendshipService.getOutgoingRequests(user1.getId());
        assertEquals(1, outgoingList.size());
        assertEquals(user2.getId(), outgoingList.get(0).getOtherUserId());

        List<FriendRequestDTO> incomingList = friendshipService.getIncomingRequests(user2.getId());
        assertEquals(1, incomingList.size());
        assertEquals(user1.getId(), incomingList.get(0).getOtherUserId());

        // Verify status after request
        List<UserSearchDTO> searchAfterSend = friendshipService.searchUsers("test_friend_2", user1.getId());
        assertEquals(1, searchAfterSend.size());
        assertEquals("PENDING_OUTGOING", searchAfterSend.get(0).getFriendshipStatus());

        List<UserSearchDTO> searchAfterSendIncoming = friendshipService.searchUsers("test_friend_1", user2.getId());
        assertEquals(1, searchAfterSendIncoming.size());
        assertEquals("PENDING_INCOMING", searchAfterSendIncoming.get(0).getFriendshipStatus());

        // 4. Accept Friend Request: User 2 accepts the request from User 1
        friendshipService.acceptRequest(request.getRequestId(), user2.getId());

        // Confirm they are friends now
        assertTrue(friendshipService.areFriends(user1.getId(), user2.getId()));
        assertTrue(friendshipService.areFriends(user2.getId(), user1.getId()));

        List<FriendDTO> friendsOf1 = friendshipService.getFriends(user1.getId());
        assertEquals(1, friendsOf1.size());
        assertEquals(user2.getId(), friendsOf1.get(0).getUserId());

        List<FriendDTO> friendsOf2 = friendshipService.getFriends(user2.getId());
        assertEquals(1, friendsOf2.size());
        assertEquals(user1.getId(), friendsOf2.get(0).getUserId());

        // 5. Privacy Gate after Friendship: Comparing should bypass the gate (it might throw another error or pass depending on data in DW)
        // Since test_friend_1 and test_friend_2 have no actual scrobble history in dw schema,
        // it might throw a NOT_FOUND/FORBIDDEN related to DW data, but NOT "You can only compare with your friends"
        try {
            socialService.compareUsers(user1.getId(), user2.getId());
        } catch (ResponseStatusException e) {
            assertNotEquals("You can only compare with your friends", e.getReason());
            System.out.println("Bypassed Privacy Gate successfully: " + e.getReason());
        }

        // 6. Unfriend: User 1 removes User 2
        friendshipService.removeFriend(user1.getId(), user2.getId());
        assertFalse(friendshipService.areFriends(user1.getId(), user2.getId()));
        assertEquals(0, friendshipService.getFriends(user1.getId()).size());
    }

    @Test
    void testAdminToggleFriendingRequests() {
        System.out.println("--- Starting Admin Toggle Restriction Test ---");

        // Disable friending global toggle
        systemSettingsService.setFriendingEnabled(false, 1L);
        assertFalse(systemSettingsService.isFriendingEnabled());

        // Attempting to send request should be forbidden
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            friendshipService.sendRequest(user1.getId(), user2.getId());
        });
        assertEquals(403, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("disabled by the administrator"));

        // Enable it back
        systemSettingsService.setFriendingEnabled(true, 1L);
        assertTrue(systemSettingsService.isFriendingEnabled());

        // Should now allow sending request
        FriendRequestDTO request = friendshipService.sendRequest(user1.getId(), user2.getId());
        assertNotNull(request);
    }
}
