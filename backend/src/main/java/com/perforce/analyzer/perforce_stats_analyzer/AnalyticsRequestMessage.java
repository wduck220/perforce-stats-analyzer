package com.perforce.analyzer.perforce_stats_analyzer;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AnalyticsRequestMessage {
    private String period_from;
    private String period_to;
    private List<ChangelistTransaction> submits;
}
