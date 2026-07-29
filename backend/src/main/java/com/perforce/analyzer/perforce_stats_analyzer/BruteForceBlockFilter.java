package com.perforce.analyzer.perforce_stats_analyzer;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class BruteForceBlockFilter extends OncePerRequestFilter {

    @Autowired
    private LoginAttemptService loginAttemptService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        if (loginAttemptService.isBlocked(ip)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Слишком много неудачных попыток входа. Попробуйте позже.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
