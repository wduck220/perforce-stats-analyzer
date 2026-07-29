package com.perforce.analyzer.perforce_stats_analyzer;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class PerforceIncrementalSyncService {

    @Autowired
    private PendingSyncRepository pendingSyncRepository;

    @Autowired
    private RawChangelistRepository rawChangelistRepository;

    @Autowired
    private PerforceChangelistFetcher changelistFetcher;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EmailService emailService;

    private static final List<String> CHANGELIST_EVENT_TYPES = List.of("change-commit", "change-edit");
    private static final long DEFAULT_INTERVAL_MS = 1296000000L;

    /**
     * Расписание запускается вручную, через ScheduledExecutorService, а не
     * через @Scheduled(fixedRateString = "${...}") — тройной случай подряд
     * показал, что плейсхолдер Spring слишком хрупко себя ведёт (пустая-но-
     * заданная переменная окружения через docker-compose ломает и дефолт
     * в аннотации, и вложенный system-property-плейсхолдер). Читаем
     * переменную сами, напрямую, без посредничества Spring вообще.
     */
    @PostConstruct
    public void scheduleSync() {
        long intervalMs = resolveIntervalMs();
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "perforce-incremental-sync");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(this::runIncrementalSync, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
        System.out.println("[IncrementalSync] Расписание запущено, интервал: " + intervalMs + " мс");
    }

    private long resolveIntervalMs() {
        String raw = System.getenv("REPORT_SYNC_INTERVAL_MS");
        try {
            return (raw == null || raw.isBlank()) ? DEFAULT_INTERVAL_MS : Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return DEFAULT_INTERVAL_MS;
        }
    }

    public void runIncrementalSync() {
        List<PendingSync> pending = pendingSyncRepository.findAll();
        if (pending.isEmpty()) {
            System.out.println("[IncrementalSync] Нет накопленных изменений, пропускаем.");
            return;
        }

        List<PendingSync> changelistEvents = pending.stream()
                .filter(p -> CHANGELIST_EVENT_TYPES.contains(p.getEventType()))
                .collect(Collectors.toList());

        List<Integer> idsToRefetch = changelistEvents.stream()
                .map(p -> Integer.parseInt(p.getEntityId()))
                .distinct()
                .collect(Collectors.toList());

        if (!idsToRefetch.isEmpty()) {
            try {
                List<ChangelistTransaction> updated = changelistFetcher.fetchSpecificChangelists(idsToRefetch);
                for (ChangelistTransaction t : updated) {
                    String json = objectMapper.writeValueAsString(t);
                    RawChangelist existing = rawChangelistRepository.findById(t.getChangeListId()).orElse(null);
                    if (existing != null) {
                        existing.setPayload(json);
                        rawChangelistRepository.save(existing);
                    } else {
                        rawChangelistRepository.save(new RawChangelist(t.getChangeListId(), json));
                    }
                }
                System.out.println("[IncrementalSync] Обновлено чейнджлистов: " + updated.size());
            } catch (Exception e) {
                System.err.println("[IncrementalSync] Ошибка при догрузке чейнджлистов: " + e.getMessage());
                e.printStackTrace();
                return;
            }
        }

        pendingSyncRepository.deleteAll(pending);
        System.out.println("[IncrementalSync] Обработано и очищено сигналов: " + pending.size());

        emailService.sendDataUpdatedNotification((int) rawChangelistRepository.count());
    }
}
