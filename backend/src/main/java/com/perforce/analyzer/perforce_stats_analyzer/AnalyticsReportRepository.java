package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface AnalyticsReportRepository extends JpaRepository<AnalyticsReport, Long> {

    Optional<AnalyticsReport> findFirstByPeriodFromAndPeriodToOrderByGeneratedAtDesc(
            LocalDate periodFrom, LocalDate periodTo
    );
}
