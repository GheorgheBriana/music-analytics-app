package com.alltimewrapped.backend.dto;

import lombok.*;
import java.time.OffsetDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FriendDTO {
    private Long userId;
    private String username;
    private OffsetDateTime friendsSince;
}
