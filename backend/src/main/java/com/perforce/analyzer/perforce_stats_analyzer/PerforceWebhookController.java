package com.perforce.analyzer.perforce_stats_analyzer;

import com.perforce.p4java.server.IOptionsServer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class PerforceWebhookController {

    @Autowired
    private PendingSyncRepository pendingSyncRepository;

    @Autowired
    private PerforceChangelistFetcher changelistFetcher;

    @Autowired
    private PerforceTriggerSetup triggerSetup;

    @Value("${perforce.trigger.secret}")
    private String triggerSecret;

    @PostMapping("/api/perforce/notify")
    public ResponseEntity<Void> notify(
            @RequestHeader(value = "X-Trigger-Secret", required = false) String providedSecret,
            @RequestBody PerforceNotifyPayload payload
    ) {
        if (triggerSecret == null || triggerSecret.isBlank() || !triggerSecret.equals(providedSecret)) {
            return ResponseEntity.status(403).build();
        }
        pendingSyncRepository.save(new PendingSync(payload.getEventType(), payload.getEntityId(), Instant.now()));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/admin/setup-triggers")
    public ResponseEntity<String> setupTriggers() {
        try {
            IOptionsServer server = changelistFetcher.connectToServer();
            try {
                String result = triggerSetup.ensureTriggersConfigured(server);
                return ResponseEntity.ok(result);
            } finally {
                server.disconnect();
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Ошибка настройки триггеров: " + e.getMessage());
        }
    }

    public static class PerforceNotifyPayload {
        private String eventType;
        private String entityId;

        public String getEventType() {
            return eventType;
        }

        public void setEventType(String eventType) {
            this.eventType = eventType;
        }

        public String getEntityId() {
            return entityId;
        }

        public void setEntityId(String entityId) {
            this.entityId = entityId;
        }
    }
}
