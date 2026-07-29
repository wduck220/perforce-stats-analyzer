package com.perforce.analyzer.perforce_stats_analyzer;

import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

@Component
public class PerforceScriptDeployer {

    @Value("${perforce.ssh.host}")
    private String sshHost;

    @Value("${perforce.ssh.port}")
    private String sshPortRaw;

    @Value("${perforce.ssh.user}")
    private String sshUser;

    @Value("${perforce.ssh.password}")
    private String sshPassword;

    @Value("${perforce.trigger.script.path}")
    private String remoteScriptPath;

    @Value("${server.public.host}")
    private String dashboardHost;

    @Value("${perforce.trigger.secret}")
    private String triggerSecret;

    public String deployHandlerScript() throws Exception {
        int sshPort = 22;
        try {
            sshPort = Integer.parseInt(sshPortRaw.trim());
        } catch (Exception e) {
            sshPort = 22;
        }

        String scriptContent = new String(
                new ClassPathResource("perforce_notify_handler.py").getInputStream().readAllBytes(),
                StandardCharsets.UTF_8
        );
        scriptContent = scriptContent
                .replace("YOUR_JAVA_HOST", dashboardHost)
                .replace("TRIGGER_SECRET_PLACEHOLDER", triggerSecret);

        JSch jsch = new JSch();
        Session session = jsch.getSession(sshUser, sshHost, sshPort);
        session.setPassword(sshPassword);
        session.setConfig("StrictHostKeyChecking", "no");
        session.connect(10000);

        try {
            ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect(10000);

            try (var localFile = new ByteArrayInputStream(scriptContent.getBytes(StandardCharsets.UTF_8))) {
                sftp.put(localFile, remoteScriptPath);
            }

            sftp.chmod(0755, remoteScriptPath);
            sftp.disconnect();

            return "Скрипт загружен на " + sshHost + ":" + remoteScriptPath;
        } finally {
            session.disconnect();
        }
    }
}
