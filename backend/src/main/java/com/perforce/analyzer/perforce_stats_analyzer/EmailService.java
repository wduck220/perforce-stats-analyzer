package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Component
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${report.email.recipient}")
    private String recipient;

    @Value("${report.dashboard.url}")
    private String dashboardUrl;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    public void sendDataUpdatedNotification(int totalSubmits) {
        if (recipient == null || recipient.isBlank()) {
            System.out.println("REPORT_EMAIL_RECIPIENT не задан, письмо не отправлено.");
            return;
        }

        String body = "Здравствуйте!\n\n"
                + "Данные в дашборде Perforce Analytics обновлены.\n\n"
                + "Последнее обновление: " + LocalDateTime.now().format(FORMATTER) + "\n"
                + "Всего сабмитов: " + totalSubmits + "\n\n"
                + "Открыть дашборд: " + dashboardUrl + "\n\n"
                + "---\n"
                + "Автоматическое уведомление, не отвечайте на это письмо.";

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(recipient);
        message.setSubject("Данные обновлены — Perforce Analytics");
        message.setText(body);

        try {
            mailSender.send(message);
            System.out.println("Письмо с уведомлением отправлено на " + recipient);
        } catch (Exception e) {
            System.err.println("Не удалось отправить письмо: " + e.getMessage());
        }
    }
}
