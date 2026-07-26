package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;

@SpringBootApplication
public class PerforceStatsAnalyzerApplication {

	public static void main(String[] args) {
		ApplicationContext context = SpringApplication.run(PerforceStatsAnalyzerApplication.class, args);
		PerforceChangelistFetcher fetcher = context.getBean(PerforceChangelistFetcher.class);
		fetcher.fetchAndPublishChangelists();
	}

}
