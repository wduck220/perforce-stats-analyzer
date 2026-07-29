# Perforce Stats Analyzer

Аналитическая система для Perforce-репозиториев: собирает историю чейнджлистов, считает статистику и ML-аналитику (аномалии, кластеризация, ассоциативные правила, корреляции) и показывает всё это в защищённом логином дашборде.

## Архитектура

```
Perforce Server
      │  (P4Java)
      ▼
┌─────────────────┐        ┌──────────┐        ┌────────────────────┐
│   Java-сервис    │───────▶│ RabbitMQ │───────▶│  Python-консьюмер   │
│  (Spring Boot)   │◀───────│  очередь │◀───────│  (аналитика/ML)     │
└─────────────────┘        └──────────┘        └────────────────────┘
      │
      ├──▶ PostgreSQL (сырые чейнджлисты + посчитанные отчёты)
      │
      │  HTTPS + логин через Perforce
      ▼
┌─────────────────┐
│    Дашборд      │
│  (HTML/JS/Chart.js)
└─────────────────┘

Perforce Server ──(триггеры)──▶ notify-скрипт ──▶ Java (очередь на дозагрузку)
```

1. **Java** подключается к Perforce через P4Java, вытягивает все чейнджлисты с полными данными по файлам, сохраняет в PostgreSQL и публикует в RabbitMQ.
2. **Python-консьюмер** слушает очередь, прогоняет данные через аналитический пайплайн и отвечает тем же путём (RPC через `reply_to`/`correlation_id`).
3. **Java** кэширует посчитанный отчёт в БД (5 минут) и отдаёт результат по HTTPS — либо сырые чейнджлисты (`/api/commits`), либо посчитанный отчёт (`/api/analytics/recalculate`).
4. **Дашборд** — статический HTML за логином (реальные учётные данные Perforce), делает оба запроса при открытии и строит все графики/таблицы на реальных данных.
5. **Триггеры Perforce** (опционально, требует SSH-доступа к серверу) — при новом сабмите или правке чейнджлиста/пользователя/депо сервер сам уведомляет Java, которая копит сигналы и раз в N дней дозагружает только изменившееся, не гоняя всё заново.

## Возможности

### Аналитика (Python)
- **Statistics** — описательная статистика (mean/std/квартили/skew/kurtosis), категориальные распределения, статистика по времени
- **Correlations** — Pearson, Spearman (полные матрицы + сильные пары с p-value) и Cramér's V
- **Anomalies** — голосующий ансамбль из 4 методов (IQR, Z-score, Isolation Forest, LOF) на 5 уровнях
- **Clustering** — K-Means с автоподбором числа кластеров по силуэту
- **Apriori** — ассоциативные правила (support/confidence/lift)

### Дашборд
- Тепловая карта активности, динамика сабмитов, Bus Factor, Hot Files / Churn
- Карточки авторов, кластеризация и сравнение авторов/депо/воркспейсов
- Общий фильтр по депо/воркспейсам/расширениям
- Экспорт в PDF и CSV

### Инфраструктура и безопасность
- Данные накопительно хранятся в **PostgreSQL** — переживают перезапуск, не только в памяти
- Кэширование отчётов (5 минут) — не пересчитывает то же самое подряд
- **HTTPS** с автоматической генерацией самоподписанного сертификата при первом запуске
- **Авторизация через реальные учётные данные Perforce** — своя страница логина, без отдельного захардкоженного аккаунта
- Защита от перебора паролей (временная блокировка IP после нескольких неудачных попыток)
- Инкрементальная догрузка через **триггеры Perforce** — не нужно перечитывать весь репозиторий, чтобы увидеть новое
- Email-уведомление о готовности данных
- Секрет на служебном webhook-эндпоинте, CSRF-защита на остальном API

## Стек

| Слой | Технологии |
|---|---|
| Backend | Java 17, Spring Boot 3.2.5, Spring Security, Spring Data JPA, P4Java, Spring AMQP (RabbitMQ), JSch |
| Хранилище | PostgreSQL |
| Аналитика | Python 3, pandas, numpy, scikit-learn, scipy, mlxtend, pika |
| Дашборд | Vanilla JS, Chart.js, jsPDF |
| Инфраструктура | Docker Compose (RabbitMQ, PostgreSQL, backend, analyzer) |

## Структура проекта

```
├── backend/
│   ├── Dockerfile                    # многоэтапная сборка (Maven внутри Docker)
│   └── src/main/
│       ├── resources/
│       │   ├── application.properties
│       │   ├── static/                        # дашборд
│       │   │   ├── index.html
│       │   │   ├── login.html
│       │   │   ├── css/
│       │   │   └── js/
│       │   └── perforce_notify_handler.py      # деплоится на сервер Perforce
│       └── java/.../perforce_stats_analyzer/
│           ├── PerforceStatsAnalyzerApplication.java
│           ├── PerforceChangelistFetcher.java        # сбор чейнджлистов, полная + точечная загрузка
│           ├── AnalyticsController.java               # REST API, кэширование отчётов
│           ├── RabbitConfig.java
│           ├── ChangelistTransaction.java
│           ├── AnalyticsRequestMessage.java / AnalyticsFilterRequest.java
│           │
│           ├── AnalyticsReport.java / AnalyticsReportRepository.java     # БД: отчёты
│           ├── RawChangelist.java / RawChangelistRepository.java         # БД: сырые чейнджлисты
│           ├── PendingSync.java / PendingSyncRepository.java             # БД: очередь триггеров
│           │
│           ├── PerforceTriggerSetup.java          # настройка триггеров на сервере Perforce
│           ├── PerforceScriptDeployer.java         # доставка notify-скрипта по SSH/SFTP
│           ├── PerforceWebhookController.java      # приём уведомлений от триггеров
│           ├── PerforceIncrementalSyncService.java # периодическая дозагрузка изменений
│           ├── EmailService.java                   # уведомление о готовности данных
│           │
│           ├── SecurityConfig.java                 # HTTPS-логин через Perforce
│           ├── PerforceAuthenticationProvider.java # проверка логина/пароля напрямую в Perforce
│           ├── LoginAttemptService.java / AuthenticationFailureListener.java / BruteForceBlockFilter.java
│           └── PerforceTriggerSetup.java
│
├── analyzer/                  # Python-пайплайн аналитики
│   ├── Dockerfile
│   ├── rabbit_consumer.py
│   ├── analytics_pipeline.py
│   ├── feature_extractor.py / feature_cleaner.py
│   ├── statistics_pipeline.py / correlation_analyzer.py
│   ├── anomaly_detector.py / anomaly_detection_pipeline.py
│   ├── clustering_pipeline.py / clustering_runner.py / clustering_utils.py
│   ├── prepare_clustering_data.py
│   └── apriori_runner.py
│
├── docker-compose.yml
└── .env                        # секреты, не коммитится (см. .env.example)
```

## Настройка `.env`

Скопируйте `.env.example` в `.env` и заполните реальными значениями:

```
PERFORCE_HOST=...           # IP/адрес сервера Perforce
PERFORCE_PORT=1666
PERFORCE_USER=...           # сервисный аккаунт для сбора данных
PERFORCE_PASSWORD=...

DB_USER / DB_PASSWORD       # PostgreSQL

MAIL_USERNAME / MAIL_PASSWORD   # SMTP-аккаунт для уведомлений (app-пароль, не основной)
REPORT_EMAIL_RECIPIENT          # кому слать уведомления

SERVER_PUBLIC_HOST          # IP сервера — используется в самоподписанном сертификате
SSL_KEYSTORE_PASSWORD       # пароль сертификата (можно оставить changeit)

PERFORCE_SSH_HOST / USER / PASSWORD   # опционально — для автодоставки триггерного скрипта
PERFORCE_TRIGGER_SECRET               # секрет для служебного webhook-эндпоинта
```

## Запуск

Одна команда поднимает всё — RabbitMQ, PostgreSQL, backend и Python-аналитику:

```bash
docker-compose up -d --build
```

При первом старте backend сам:
- генерирует самоподписанный HTTPS-сертификат,
- подключается к Perforce и загружает чейнджлисты в БД,
- пробует настроить триггеры и доставить notify-скрипт (не критично, если SSH недоступен — просто пропустится).

Проверить, что всё поднялось:
```bash
docker ps
```

## Доступ к дашборду

```
https://<адрес сервера>:8443/index.html
```

Браузер спросит про самоподписанный сертификат — принять при первом заходе. Дальше — автоматический редирект на страницу логина: вводите **реальный логин и пароль от Perforce**, дашборд откроется сам после успешного входа.

## API

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/commits` | Сырые чейнджлисты (кэш последнего сбора) |
| `POST` | `/api/analytics/recalculate` | Пересчёт аналитики (или отдача закэшированного, если считали <5 минут назад) |
| `POST` | `/api/perforce/notify` | Приём уведомлений от триггеров Perforce (требует заголовок `X-Trigger-Secret`) |
| `POST` | `/api/admin/setup-triggers` | Ручная (пере)настройка триггеров на сервере Perforce |

## Известные ограничения

- Внешний доступ к дашборду зависит от сетевой конфигурации (firewall, проброс портов, возможный CGNAT у домашних провайдеров) — не гарантирован «из коробки» без дополнительной настройки сети.
- Инкрементальная синхронизация через триггеры требует SSH-доступа к машине с `p4d` для автодоставки скрипта — без этого доступна только полная загрузка при старте.
- Email-уведомления настроены, но зависят от реального SMTP-аккаунта в `.env`.
- Фильтрация по депо/воркспейсу/автору на уровне ML-разделов — это показ подмножества уже посчитанного, не пересчёт с нуля.
- При малом числе сущностей (меньше 3 авторов/депо/воркспейсов) агрегированные уровни аномалий и кластеризации не считаются — дашборд явно показывает сообщение о нехватке данных.
