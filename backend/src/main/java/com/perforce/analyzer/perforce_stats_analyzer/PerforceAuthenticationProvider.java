package com.perforce.analyzer.perforce_stats_analyzer;

import com.perforce.p4java.server.IOptionsServer;
import com.perforce.p4java.server.ServerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PerforceAuthenticationProvider implements AuthenticationProvider {

    @Value("${perforce.host}")
    private String p4Host;

    @Value("${perforce.port}")
    private String p4Port;

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String username = authentication.getName();
        String password = authentication.getCredentials() != null ? authentication.getCredentials().toString() : "";

        IOptionsServer server = null;
        try {
            String serverUri = String.format("p4java://%s:%s", p4Host, p4Port);
            server = ServerFactory.getOptionsServer(serverUri, null);
            server.connect();
            server.setUserName(username);
            server.login(password);

            return new UsernamePasswordAuthenticationToken(
                    username,
                    password,
                    List.of(new SimpleGrantedAuthority("ROLE_USER"))
            );
        } catch (Exception e) {
            throw new BadCredentialsException("Неверный логин или пароль Perforce", e);
        } finally {
            if (server != null) {
                try {
                    server.disconnect();
                } catch (Exception ignored) {
                }
            }
        }
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
