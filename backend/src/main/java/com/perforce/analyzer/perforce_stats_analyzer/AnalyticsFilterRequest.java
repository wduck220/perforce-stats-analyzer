package com.perforce.analyzer.perforce_stats_analyzer;

import lombok.Data;

@Data
public class AnalyticsFilterRequest {
    private String periodFrom;
    private String periodTo;
}
