package com.alltimewrapped.backend.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserSearchDTO {
    private Long userId;
    private String username;
    private String friendshipStatus;  // "NONE", "PENDING_OUTGOING", "PENDING_INCOMING", "FRIENDS", "BLOCKED"
    private String avatarUrl;
    private String favoriteGenre;
    private String bio;
}
