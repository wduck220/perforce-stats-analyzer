package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_SECONDS = 15 * 60;
    private static final long BLOCK_SECONDS = 30 * 60;

    private static class Attempt {
        int count;
        Instant firstFailure;
        Instant blockedUntil;
    }

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public void loginFailed(String ip) {
        Attempt a = attempts.computeIfAbsent(ip, k -> new Attempt());
        synchronized (a) {
            Instant now = Instant.now();
            if (a.firstFailure == null || now.getEpochSecond() - a.firstFailure.getEpochSecond() > WINDOW_SECONDS) {
                a.firstFailure = now;
                a.count = 0;
            }
            a.count++;
            if (a.count >= MAX_ATTEMPTS) {
                a.blockedUntil = now.plusSeconds(BLOCK_SECONDS);
            }
        }
    }

    public void loginSucceeded(String ip) {
        attempts.remove(ip);
    }

    public boolean isBlocked(String ip) {
        Attempt a = attempts.get(ip);
        if (a == null || a.blockedUntil == null) {
            return false;
        }
        if (Instant.now().isAfter(a.blockedUntil)) {
            attempts.remove(ip);
            return false;
        }
        return true;
    }
}
