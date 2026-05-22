package com.alltimewrapped.backend.admin.dto;

import com.alltimewrapped.backend.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserSummaryDto {
    private Long id;
    private String username;
    private String email;
    private UserRole role;
    private LocalDateTime createdAt;
    private Long listeningRecordsCount;
    private Long factsInWarehouseCount;
    private boolean spotifyConnected;
}
