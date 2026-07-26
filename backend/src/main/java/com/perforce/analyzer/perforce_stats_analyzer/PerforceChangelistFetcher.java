package com.perforce.analyzer.perforce_stats_analyzer;

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
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static com.perforce.analyzer.perforce_stats_analyzer.RabbitConfig.ANALYZER_QUEUE;

@Component
public class PerforceChangelistFetcher {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private volatile List<ChangelistTransaction> lastFetchedTransactions = Collections.emptyList();

    public List<ChangelistTransaction> getLastFetchedTransactions() {
        return lastFetchedTransactions;
    }

    public void fetchAndPublishChangelists() {
        String p4Port = "1666";
        String p4User = "ServiceControl2";
        String p4Password = "123";
        String serverUri = String.format("p4java://%s:%s", "91.217.80.120", p4Port);

        IOptionsServer server = null;
        try {
            server = ServerFactory.getOptionsServer(serverUri, null);
            server.connect();

            server.setUserName(p4User);
            server.login(p4Password);

            RabbitAdmin admin = new RabbitAdmin(rabbitTemplate);
            admin.purgeQueue(ANALYZER_QUEUE, true);

            if (server.isConnected()) {
                System.out.println("Успешное подключение к Perforce серверу!");
                List<IChangelistSummary> changeLists = server.getChangelists(
                        -1,
                        null,
                        null,
                        null,
                        false,
                        true,
                        false,
                        false
                );

                List<ChangelistTransaction> transactions = new ArrayList<>();
                for (IChangelistSummary change : changeLists) {
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

                    transactions.add(new ChangelistTransaction(
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
                    ));
                }

                this.lastFetchedTransactions = transactions;

                rabbitTemplate.convertAndSend(ANALYZER_QUEUE, transactions);
                System.out.println("Отправлено " + transactions.size() + " DTO в очередь " + ANALYZER_QUEUE);
            }
        } catch (Exception e) {
            System.err.println("Ошибка подключения: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
