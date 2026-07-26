package com.perforce.analyzer.perforce_stats_analyzer;

import com.perforce.p4java.core.ChangelistStatus;
import com.perforce.p4java.core.file.FileAction;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
public class ChangelistTransaction {
    private String username;
    private Date date;
    private int changeListId;
    private String description;
    private ChangelistStatus changeListStatus;
    private List<String> depotNames;
    private List<String> filenames;
    private List<FileAction> fileActions;
    private List<Long> sizes;
    private String clientId;
    private List<String> fileTypes;
    private List<Integer> fileRevisions;
}
