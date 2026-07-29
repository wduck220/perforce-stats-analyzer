package com.perforce.analyzer.perforce_stats_analyzer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.perforce.p4java.core.IChangelist;
import com.perforce.p4java.core.IChangelistSummary;
import com.perforce.p4java.core.file.FileAction;
import com.perforce.p4java.core.file.IExtendedFileSpec;
import com.perforce.p4java.core.file.IFileSize;
import com.perforce.p4java.core.file.IFileSpec;
import com.perforce.p4java.server.IOptionsServer;
import com.perforce.p4java.server.ServerFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static com.perforce.analyzer.perforce_stats_analyzer.RabbitConfig.ANALYZER_QUEUE;

@Component
public class PerforceChangelistFetcher {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private RawChangelistRepository rawChangelistRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${perforce.host}")
    private String p4Host;

    @Value("${perforce.port}")
    private String p4Port;

    @Value("${perforce.user}")
    private String p4User;

    @Value("${perforce.password}")
    private String p4Password;

    private volatile List<ChangelistTransaction> lastFetchedTransactions = Collections.emptyList();

    public List<ChangelistTransaction> getLastFetchedTransactions() {
        return lastFetchedTransactions;
    }

    IOptionsServer connectToServer() throws Exception {
        String serverUri = String.format("p4java://%s:%s", p4Host, p4Port);
        IOptionsServer server = ServerFactory.getOptionsServer(serverUri, null);
        server.connect();
        server.setUserName(p4User);
        server.login(p4Password);
        return server;
    }

    private ChangelistTransaction buildTransaction(IOptionsServer server, IChangelistSummary change) throws Exception {
        IChangelist fullChangelist = server.getChangelist(change.getId());
        List<IFileSpec> files = fullChangelist.getFiles(true);
        List<IFileSize> fileSizes = server.getFileSizes(files, null);
        List<IExtendedFileSpec> extendedFiles = server.getExtendedFiles(files, null);
        List<String> depotNames = new ArrayList<>();
        List<String> fileNames = new ArrayList<>();
        List<FileAction> fileActions = new ArrayList<>();
        List<Long> sizes = new ArrayList<>();
        String clientId = change.getClientId();
        List<String> fileTypes = new ArrayList<>();
        List<Integer> fileRevisions = new ArrayList<>();

        for (int i = 0; i < files.size(); i++) {
            IFileSpec file = files.get(i);
            String path = file.getDepotPathString();

            int start = path.indexOf("//");
            int end = path.indexOf("/", start + 2);
            int lastSlash = path.lastIndexOf('/');

            depotNames.add(path.substring(start + 2, end));
            fileNames.add(path.substring(lastSlash + 1));
            fileActions.add(file.getAction());

            sizes.add(fileSizes.get(i).getFileSize());

            fileTypes.add(file.getFileType());

            IExtendedFileSpec extFile = extendedFiles.get(i);
            fileRevisions.add(extFile.getHeadRev());
        }

        return new ChangelistTransaction(
                change.getUsername(),
                change.getDate(),
                change.getId(),
                change.getDescription(),
                change.getStatus(),
                depotNames,
                fileNames,
                fileActions,
                sizes,
                clientId,
                fileTypes,
                fileRevisions
        );
    }

    private void persistToDatabase(List<ChangelistTransaction> transactions) {
        for (ChangelistTransaction t : transactions) {
            try {
                String json = objectMapper.writeValueAsString(t);
                RawChangelist existing = rawChangelistRepository.findById(t.getChangeListId()).orElse(null);
                if (existing != null) {
                    existing.setPayload(json);
                    rawChangelistRepository.save(existing);
                } else {
                    rawChangelistRepository.save(new RawChangelist(t.getChangeListId(), json));
                }
            } catch (Exception e) {
                System.err.println("Не удалось сохранить чейнджлист " + t.getChangeListId() + ": " + e.getMessage());
            }
        }
    }

    public void fetchAndPublishChangelists() {
        IOptionsServer server = null;
        try {
            server = connectToServer();

            RabbitAdmin admin = new RabbitAdmin(rabbitTemplate);
            admin.purgeQueue(ANALYZER_QUEUE, true);

            if (server.isConnected()) {
                System.out.println("Успешное подключение к Perforce серверу!");
                List<IChangelistSummary> changeLists = server.getChangelists(
                        -1, null, null, null, false, true, false, false
                );

                List<ChangelistTransaction> transactions = new ArrayList<>();
                int failedCount = 0;
                for (IChangelistSummary change : changeLists) {
                    try {
                        transactions.add(buildTransaction(server, change));
                    } catch (Exception e) {
                        failedCount++;
                        System.err.println("Пропущен чейнджлист " + change.getId() + ": " + e.getMessage());
                    }
                }

                this.lastFetchedTransactions = transactions;
                persistToDatabase(transactions);

                rabbitTemplate.convertAndSend(ANALYZER_QUEUE, transactions);
                System.out.println("Отправлено " + transactions.size() + " DTO в очередь " + ANALYZER_QUEUE
                        + ", сохранено в БД: " + transactions.size()
                        + (failedCount > 0 ? ", пропущено из-за ошибок: " + failedCount : ""));
            }
        } catch (Exception e) {
            System.err.println("Ошибка подключения: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public List<ChangelistTransaction> fetchSpecificChangelists(List<Integer> changeListIds) throws Exception {
        List<ChangelistTransaction> result = new ArrayList<>();
        if (changeListIds.isEmpty()) {
            return result;
        }

        IOptionsServer server = connectToServer();
        try {
            List<IChangelistSummary> all = server.getChangelists(
                    -1, null, null, null, false, true, false, false
            );

            java.util.Set<Integer> wanted = new java.util.HashSet<>(changeListIds);
            for (IChangelistSummary change : all) {
                if (wanted.contains(change.getId())) {
                    try {
                        result.add(buildTransaction(server, change));
                    } catch (Exception e) {
                        System.err.println("Пропущен чейнджлист " + change.getId() + ": " + e.getMessage());
                    }
                }
            }
        } finally {
            server.disconnect();
        }
        return result;
    }
}
