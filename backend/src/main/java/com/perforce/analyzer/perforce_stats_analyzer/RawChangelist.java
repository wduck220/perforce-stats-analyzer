package com.perforce.analyzer.perforce_stats_analyzer;

import jakarta.persistence.*;

@Entity
@Table(name = "raw_changelists")
public class RawChangelist {

    @Id
    private Integer changeListId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    public RawChangelist() {
    }

    public RawChangelist(Integer changeListId, String payload) {
        this.changeListId = changeListId;
        this.payload = payload;
    }

    public Integer getChangeListId() {
        return changeListId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }
}
