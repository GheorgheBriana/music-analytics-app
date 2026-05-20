package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(schema = "dw", name = "dw_dim_date",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_date_full_date", columnNames = "full_date")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimDate {

    @Id
    private Long dateKey;

    @Column(name = "full_date", nullable = false)
    private LocalDate fullDate;

    @Column(name = "day", nullable = false)
    private Integer day;

    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "month_name", nullable = false)
    private String monthName;

    @Column(name = "quarter", nullable = false)
    private Integer quarter;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(name = "day_name", nullable = false)
    private String dayName;

    @Column(name = "is_weekend", nullable = false)
    private Boolean isWeekend;
}
