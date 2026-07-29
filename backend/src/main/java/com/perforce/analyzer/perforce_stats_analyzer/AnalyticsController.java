package com.perforce.analyzer.perforce_stats_analyzer;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static com.perforce.analyzer.perforce_stats_analyzer.RabbitConfig.ANALYZER_QUEUE;

@RestController
@CrossOrigin(origins = "*")
public class AnalyticsController {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final long CACHE_VALID_MINUTES = 5;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private PerforceChangelistFetcher changelistFetcher;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AnalyticsReportRepository reportRepository;

    @GetMapping(value = "/api/commits", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ChangelistTransaction>> getCommits() {
        List<ChangelistTransaction> submits = changelistFetcher.getLastFetchedTransactions();
        if (submits.isEmpty()) {
            return ResponseEntity.status(409).build();
        }
        return ResponseEntity.ok(submits);
    }

    @PostMapping(value = "/api/analytics/recalculate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> recalculate(@RequestBody(required = false) AnalyticsFilterRequest filters) {
        List<ChangelistTransaction> submits = changelistFetcher.getLastFetchedTransactions();

        if (submits.isEmpty()) {
            return ResponseEntity.status(409).body(
                "{\"error\":\"Нет данных — сначала должен отработать fetchAndPublishChangelists() и заполнить кэш чейнджлистов.\"}"
            );
        }

        String periodFrom = filters != null ? filters.getPeriodFrom() : null;
        String periodTo = filters != null ? filters.getPeriodTo() : null;
        LocalDate periodFromDate = periodFrom != null ? LocalDate.parse(periodFrom, DATE_FMT) : null;
        LocalDate periodToDate = periodTo != null ? LocalDate.parse(periodTo, DATE_FMT) : null;

        Optional<AnalyticsReport> cached = reportRepository
                .findFirstByPeriodFromAndPeriodToOrderByGeneratedAtDesc(periodFromDate, periodToDate);

        if (cached.isPresent()) {
            long ageMinutes = ChronoUnit.MINUTES.between(cached.get().getGeneratedAt(), Instant.now());
            if (ageMinutes < CACHE_VALID_MINUTES) {
                return ResponseEntity.ok(cached.get().getReportJson());
            }
        }

        AnalyticsRequestMessage message = new AnalyticsRequestMessage(periodFrom, periodTo, submits);
        Object response = rabbitTemplate.convertSendAndReceive(ANALYZER_QUEUE, message);

        if (response == null) {
            return ResponseEntity.status(504).body("{\"error\":\"timeout waiting for analytics response\"}");
        }

        try {
            String json = objectMapper.writeValueAsString(response);
            reportRepository.save(new AnalyticsReport(periodFromDate, periodToDate, json, Instant.now()));
            return ResponseEntity.ok(json);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("{\"error\":\"Не удалось сериализовать ответ: " + e.getMessage() + "\"}");
        }
    }
}
