package com.perforce.analyzer.perforce_stats_analyzer;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "analytics_reports")
public class AnalyticsReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate periodFrom;
    private LocalDate periodTo;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String reportJson;

    private Instant generatedAt;

    public AnalyticsReport() {
    }

    public AnalyticsReport(LocalDate periodFrom, LocalDate periodTo, String reportJson, Instant generatedAt) {
        this.periodFrom = periodFrom;
        this.periodTo = periodTo;
        this.reportJson = reportJson;
        this.generatedAt = generatedAt;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getPeriodFrom() {
        return periodFrom;
    }

    public LocalDate getPeriodTo() {
        return periodTo;
    }

    public String getReportJson() {
        return reportJson;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }
}
