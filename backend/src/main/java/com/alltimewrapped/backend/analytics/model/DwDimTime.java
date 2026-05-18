package com.alltimewrapped.backend.analytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "dw_dim_time",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dw_dim_time_hour_minute", columnNames = {"hour", "minute"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DwDimTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long timeKey;

    @Column(name = "hour", nullable = false)
    private Integer hour;

    @Column(name = "minute", nullable = false)
    private Integer minute;

    @Column(name = "part_of_day", nullable = false)
    private String partOfDay;
}