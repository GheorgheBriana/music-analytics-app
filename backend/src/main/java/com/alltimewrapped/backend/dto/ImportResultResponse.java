package com.alltimewrapped.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportResultResponse {

    private int processedFiles;
    private int totalRecordsFound;
    private int importedRecords;
    private int duplicateRecords;
    private int skippedRecords;
}