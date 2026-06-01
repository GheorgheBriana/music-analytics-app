package com.alltimewrapped.backend.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SystemSettingDTO {
    private String key;
    private String value;
    private String description;
}
