package com.alltimewrapped.backend.dto;

import lombok.*;
import java.time.OffsetDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FriendRequestDTO {
    private Long requestId;         // ID-ul rândului din friendships
    private Long otherUserId;
    private String otherUsername;
    private OffsetDateTime createdAt;
    private String direction;       // "INCOMING" sau "OUTGOING"
}
