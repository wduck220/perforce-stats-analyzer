package com.perforce.analyzer.perforce_stats_analyzer;

import com.perforce.p4java.admin.ITriggerEntry;
import com.perforce.p4java.impl.generic.admin.TriggerEntry;
import com.perforce.p4java.server.IOptionsServer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class PerforceTriggerSetup {

    @Value("${perforce.trigger.script.path}")
    private String scriptPath;

    public String ensureTriggersConfigured(IOptionsServer server) throws Exception {
        List<ITriggerEntry> existing = server.getTriggerEntries();
        List<ITriggerEntry> combined = new ArrayList<>(existing);

        List<ITriggerEntry> required = buildRequiredTriggers(existing.size());
        List<String> added = new ArrayList<>();

        for (ITriggerEntry req : required) {
            boolean alreadyExists = existing.stream()
                    .anyMatch(e -> e.getName().equals(req.getName()));
            if (!alreadyExists) {
                combined.add(req);
                added.add(req.getName());
            }
        }

        if (added.isEmpty()) {
            return "Все нужные триггеры уже настроены, изменений не потребовалось.";
        }

        server.updateTriggerEntries(combined);
        return "Добавлены новые триггеры: " + String.join(", ", added)
                + ". Остальные " + existing.size() + " уже существовавших записей сохранены без изменений.";
    }

    private List<ITriggerEntry> buildRequiredTriggers(int startOrder) {
        List<ITriggerEntry> list = new ArrayList<>();
        int order = startOrder;

        list.add(new TriggerEntry(
                order++,
                "analyzer_change_commit",
                ITriggerEntry.TriggerType.CHANGE_COMMIT,
                "//...",
                quoted(scriptPath + " change-commit %changelist%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_change_edit",
                ITriggerEntry.TriggerType.FORM_COMMIT,
                "change",
                quoted(scriptPath + " change-edit %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_user_commit",
                ITriggerEntry.TriggerType.FORM_COMMIT,
                "user",
                quoted(scriptPath + " user-commit %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_user_delete",
                ITriggerEntry.TriggerType.FORM_DELETE,
                "user",
                quoted(scriptPath + " user-delete %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_client_commit",
                ITriggerEntry.TriggerType.FORM_COMMIT,
                "client",
                quoted(scriptPath + " client-commit %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_client_delete",
                ITriggerEntry.TriggerType.FORM_DELETE,
                "client",
                quoted(scriptPath + " client-delete %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_depot_commit",
                ITriggerEntry.TriggerType.FORM_COMMIT,
                "depot",
                quoted(scriptPath + " depot-commit %formname%")
        ));

        list.add(new TriggerEntry(
                order++,
                "analyzer_depot_delete",
                ITriggerEntry.TriggerType.FORM_DELETE,
                "depot",
                quoted(scriptPath + " depot-delete %formname%")
        ));

        return list;
    }

    private String quoted(String command) {
        return "\"" + command + "\"";
    }
}
