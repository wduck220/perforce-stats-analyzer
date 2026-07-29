package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RawChangelistRepository extends JpaRepository<RawChangelist, Integer> {

    @Query("SELECT MAX(r.changeListId) FROM RawChangelist r")
    Optional<Integer> findMaxChangeListId();

    List<RawChangelist> findAllByOrderByChangeListIdAsc();
}
