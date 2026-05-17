package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportBatchMessage {
    private Long userId;
    private int batchIndex;
    private int totalBatches;
    private List<SpotifyListeningDTO> records;
}
