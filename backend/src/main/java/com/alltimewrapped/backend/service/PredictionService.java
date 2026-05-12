package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.dto.PredictionResponse;
import com.alltimewrapped.backend.model.ListeningRecord;
import com.alltimewrapped.backend.repository.AppUserRepository;
import com.alltimewrapped.backend.repository.ListeningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PredictionService {

    private final ListeningRecordRepository listeningRecordRepository;
    private final AppUserRepository appUserRepository;

    private static final String[] MONTH_NAMES = {
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
    };

    @Transactional(readOnly = true)
    public PredictionResponse getPredictions(Long userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "User not found with id: " + userId
            );
        }

        List<ListeningRecord> records = listeningRecordRepository.findByUserId(userId);

        if (records.isEmpty()) {
            return new PredictionResponse(
                    "No data yet",
                    "No data yet",
                    null,
                    "STABLE",
                    "No data yet",
                    0.0
            );
        }

        String predictedTopArtist = predictTopArtist(records);
        String mostActiveDayOfWeek = findMostLikelyListeningDay(records);
        Integer mostActiveHour = findMostLikelyListeningHour(records);
        String mostActiveMonth = findMostLikelyActiveMonth(records);
        Double listeningChangePercent = calculateListeningChangePercent(records);
        String listeningTrend = calculateListeningTrend(listeningChangePercent);

        return new PredictionResponse(
                predictedTopArtist,
                mostActiveDayOfWeek,
                mostActiveHour,
                listeningTrend,
                mostActiveMonth,
                listeningChangePercent
        );
    }

    // Predicts the next-period top artist using the last 3 months available in the imported dataset.
    private String predictTopArtist(List<ListeningRecord> records) {
        OffsetDateTime latestListeningDate = findLatestListeningDate(records);
        OffsetDateTime threeMonthsBeforeLatestRecord = latestListeningDate.minusMonths(3);

        Map<String, Long> recentArtistPlayCount = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .filter(record -> record.getPlayedAt().isAfter(threeMonthsBeforeLatestRecord)
                        || record.getPlayedAt().isEqual(threeMonthsBeforeLatestRecord))
                .filter(record -> record.getTrack() != null)
                .filter(record -> record.getTrack().getArtistName() != null)
                .collect(Collectors.groupingBy(
                        record -> record.getTrack().getArtistName(),
                        Collectors.counting()
                ));

        if (recentArtistPlayCount.isEmpty()) {
            recentArtistPlayCount = records.stream()
                    .filter(record -> record.getTrack() != null)
                    .filter(record -> record.getTrack().getArtistName() != null)
                    .collect(Collectors.groupingBy(
                            record -> record.getTrack().getArtistName(),
                            Collectors.counting()
                    ));
        }

        return recentArtistPlayCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("No data yet");
    }

    // Finds the day when the user is most likely to listen, based on historical listening frequency.
    private String findMostLikelyListeningDay(List<ListeningRecord> records) {
        Map<DayOfWeek, Long> dayCount = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .collect(Collectors.groupingBy(
                        record -> record.getPlayedAt().getDayOfWeek(),
                        Collectors.counting()
                ));

        return dayCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(entry -> formatDayName(entry.getKey()))
                .orElse("No data yet");
    }

    // Finds the hour when the user is most likely to listen, based on historical listening frequency.
    private Integer findMostLikelyListeningHour(List<ListeningRecord> records) {
        Map<Integer, Long> hourCount = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .collect(Collectors.groupingBy(
                        record -> record.getPlayedAt().getHour(),
                        Collectors.counting()
                ));

        return hourCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    // Finds the month when the user is most likely to be active, based on historical listening frequency.
    private String findMostLikelyActiveMonth(List<ListeningRecord> records) {
        Map<Integer, Long> monthCount = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .collect(Collectors.groupingBy(
                        record -> record.getPlayedAt().getMonthValue(),
                        Collectors.counting()
                ));

        return monthCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(entry -> MONTH_NAMES[entry.getKey() - 1])
                .orElse("No data yet");
    }

    // Calculates the listening change between the latest year available in the dataset and the year before it.
    private Double calculateListeningChangePercent(List<ListeningRecord> records) {
        int latestYear = findLatestYear(records);
        int previousYear = latestYear - 1;

        long latestYearPlays = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .filter(record -> record.getPlayedAt().getYear() == latestYear)
                .count();

        long previousYearPlays = records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .filter(record -> record.getPlayedAt().getYear() == previousYear)
                .count();

        if (previousYearPlays == 0) {
            return 0.0;
        }

        double change = ((double) (latestYearPlays - previousYearPlays) / previousYearPlays) * 100;
        return Math.round(change * 100.0) / 100.0;
    }

    // Converts the percentage difference into a readable trend label.
    private String calculateListeningTrend(Double changePercent) {
        if (changePercent > 10) {
            return "INCREASING";
        }

        if (changePercent < -10) {
            return "DECREASING";
        }

        return "STABLE";
    }

    private OffsetDateTime findLatestListeningDate(List<ListeningRecord> records) {
        return records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .map(ListeningRecord::getPlayedAt)
                .max(OffsetDateTime::compareTo)
                .orElseThrow();
    }

    private int findLatestYear(List<ListeningRecord> records) {
        return records.stream()
                .filter(record -> record.getPlayedAt() != null)
                .map(record -> record.getPlayedAt().getYear())
                .max(Integer::compareTo)
                .orElseThrow();
    }

    private String formatDayName(DayOfWeek dayOfWeek) {
        String dayName = dayOfWeek.name().toLowerCase();
        return dayName.substring(0, 1).toUpperCase() + dayName.substring(1);
    }
}