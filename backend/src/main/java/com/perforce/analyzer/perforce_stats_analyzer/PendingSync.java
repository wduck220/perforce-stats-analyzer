package com.perforce.analyzer.perforce_stats_analyzer;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "pending_sync")
public class PendingSync {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String eventType;

    @Column(nullable = false)
    private String entityId;

    @Column(nullable = false)
    private Instant receivedAt;

    public PendingSync() {
    }

    public PendingSync(String eventType, String entityId, Instant receivedAt) {
        this.eventType = eventType;
        this.entityId = entityId;
        this.receivedAt = receivedAt;
    }

    public Long getId() {
        return id;
    }

    public String getEventType() {
        return eventType;
    }

    public String getEntityId() {
        return entityId;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }
}
