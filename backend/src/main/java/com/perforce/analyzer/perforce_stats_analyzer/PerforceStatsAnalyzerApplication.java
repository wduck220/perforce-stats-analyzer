package com.perforce.analyzer.perforce_stats_analyzer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;

@SpringBootApplication
@EnableScheduling
public class PerforceStatsAnalyzerApplication {

	private static final String KEYSTORE_PATH = "/app/certs/keystore.p12";

	public static void main(String[] args) {
		normalizeSyncInterval();
		ensureKeystoreExists();

		ApplicationContext context = SpringApplication.run(PerforceStatsAnalyzerApplication.class, args);

		PerforceChangelistFetcher fetcher = context.getBean(PerforceChangelistFetcher.class);
		fetcher.fetchAndPublishChangelists();

		PerforceScriptDeployer deployer = context.getBean(PerforceScriptDeployer.class);
		try {
			System.out.println(deployer.deployHandlerScript());
		} catch (Exception e) {
			System.err.println("Не удалось доставить скрипт-обработчик триггеров: " + e.getMessage());
		}

		try {
			PerforceTriggerSetup triggerSetup = context.getBean(PerforceTriggerSetup.class);
			var server = fetcher.connectToServer();
			try {
				System.out.println(triggerSetup.ensureTriggersConfigured(server));
			} finally {
				server.disconnect();
			}
		} catch (Exception e) {
			System.err.println("Не удалось настроить триггеры: " + e.getMessage());
		}
	}

	private static void normalizeSyncInterval() {
		// Та же болезнь, что и с паролем keystore: ${REPORT_SYNC_INTERVAL_MS:1296000000}
		// не срабатывает, если переменная задана, но пустая (так и происходит через
		// docker-compose, если .env её не заполнил) — @Scheduled(fixedRateString="")
		// падает ещё на старте с "One-time task only supported with specified initial delay".
		String raw = System.getenv("REPORT_SYNC_INTERVAL_MS");
		long intervalMs;
		try {
			intervalMs = (raw == null || raw.isBlank()) ? 1296000000L : Long.parseLong(raw.trim());
		} catch (NumberFormatException e) {
			intervalMs = 1296000000L;
		}
		System.setProperty("resolved.report.sync.interval.ms", String.valueOf(intervalMs));
	}

	private static void ensureKeystoreExists() {
		String password = System.getenv("SSL_KEYSTORE_PASSWORD");
		if (password == null || password.isBlank()) {
			password = "changeit";
		}
		// Spring читает пароль из своего собственного ${SSL_KEYSTORE_PASSWORD:changeit} —
		// а этот дефолт НЕ срабатывает, если переменная окружения есть, но пустая
		// (именно так и происходит через docker-compose, если .env её не задаёт).
		// Прописываем уже нормализованное значение как system property и меняем
		// application.properties на него — тогда keytool и Spring гарантированно
		// используют один и тот же пароль, а не два разных.
		System.setProperty("resolved.ssl.keystore.password", password);

		File keystoreFile = new File(KEYSTORE_PATH);
		if (keystoreFile.exists()) {
			System.out.println("Keystore уже существует: " + KEYSTORE_PATH);
			return;
		}
		keystoreFile.getParentFile().mkdirs();

		String host = System.getenv("SERVER_PUBLIC_HOST");
		if (host == null || host.isBlank()) {
			host = "localhost";
		}

		boolean isIpAddress = host.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$");
		String sanType = isIpAddress ? "ip" : "dns";

		try {
			ProcessBuilder pb = new ProcessBuilder(
					"keytool", "-genkeypair",
					"-alias", "dashboard",
					"-keyalg", "RSA",
					"-keysize", "2048",
					"-storetype", "PKCS12",
					"-keystore", KEYSTORE_PATH,
					"-validity", "3650",
					"-storepass", password,
					"-dname", "CN=" + host,
					"-ext", "SAN=" + sanType + ":" + host
			);
			pb.redirectErrorStream(true);
			Process process = pb.start();
			process.getInputStream().transferTo(System.out);
			int exitCode = process.waitFor();
			if (exitCode == 0) {
				System.out.println("Самоподписанный сертификат сгенерирован автоматически: " + KEYSTORE_PATH);
			} else {
				System.err.println("keytool завершился с кодом " + exitCode);
			}
		} catch (Exception e) {
			System.err.println("Не удалось сгенерировать keystore автоматически: " + e.getMessage());
		}
	}

}
