package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.web.authentication.WebAuthenticationDetails;
import org.springframework.stereotype.Component;

@Component
public class AuthenticationFailureListener {

    @Autowired
    private LoginAttemptService loginAttemptService;

    @EventListener
    public void onAuthenticationFailure(AuthenticationFailureBadCredentialsEvent event) {
        Object details = event.getAuthentication().getDetails();
        if (details instanceof WebAuthenticationDetails webDetails) {
            String ip = webDetails.getRemoteAddress();
            loginAttemptService.loginFailed(ip);
            System.out.println("Неудачная попытка входа с IP: " + ip);
        }
    }

    @EventListener
    public void onAuthenticationSuccess(org.springframework.security.authentication.event.AuthenticationSuccessEvent event) {
        Object details = event.getAuthentication().getDetails();
        if (details instanceof WebAuthenticationDetails webDetails) {
            loginAttemptService.loginSucceeded(webDetails.getRemoteAddress());
        }
    }
}
