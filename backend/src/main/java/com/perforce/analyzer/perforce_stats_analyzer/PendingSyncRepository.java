package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PendingSyncRepository extends JpaRepository<PendingSync, Long> {

    List<PendingSync> findByEventType(String eventType);
}
