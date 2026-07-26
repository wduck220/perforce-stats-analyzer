# Perforce Stats Analyzer

Аналитическая система для Perforce-репозиториев: собирает историю чейнджлистов, считает статистику и ML-аналитику (аномалии, кластеризация, ассоциативные правила, корреляции) и показывает всё это в дашборде.

## Архитектура

```
Perforce Server
      │  (P4Java)
      ▼
┌─────────────────┐        ┌──────────┐        ┌────────────────────┐
│   Java-сервис    │──────▶│ RabbitMQ │──────▶│  Python-консьюмер   │
│  (Spring Boot)   │◀──────│  очередь │◀──────│  (аналитика/ML)     │
└─────────────────┘        └──────────┘        └────────────────────┘
      │  REST API (/api/commits, /api/analytics/recalculate)
      ▼
┌─────────────────┐
│    Дашборд       │
│  (HTML/JS/Chart.js)
└─────────────────┘
```

1. Java подключается к Perforce через P4Java, вытягивает все чейнджлисты с полными данными по файлам (депо, воркспейс, действия, размеры, ревизии), кэширует и публикует в RabbitMQ.
2. Python-консьюмер слушает очередь, прогоняет данные через аналитический пайплайн и отвечает тем же путём (RPC через `reply_to`/`correlation_id`).
3. Java отдаёт результат дальше по HTTP — либо сырые чейнджлисты (`/api/commits`), либо посчитанный отчёт (`/api/analytics/recalculate`).
4. Дашборд — статический HTML, который делает оба запроса при открытии страницы и строит все графики/таблицы на реальных данных.

## Скриншоты

<!-- добавить скриншоты дашборда: heatmap активности, аномалии, bus factor -->

## Возможности

### Аналитика (Python)
- Statistics — описательная статистика (mean/std/квартили/skew/kurtosis), категориальные распределения, статистика по времени (часы/дни недели)
- Correlations — Pearson, Spearman (полные матрицы + сильные пары с p-value) и Cramér's V для категориальных признаков
- Anomalies — голосующий ансамбль из 4 методов (IQR, Z-score, Isolation Forest, LOF) на 5 уровнях: сабмиты, авторы, дни, депо, воркспейсы
- Clustering — K-Means с автоподбором числа кластеров по силуэту, на нескольких уровнях группировки
- Apriori — ассоциативные правила (support/confidence/lift) поверх категориальных признаков сабмита

### Дашборд
- Тепловая карта активности, динамика сабмитов по дням/неделям/месяцам/годам
- Bus Factor (кто «держит» файлы в одиночку), Hot Files / Churn
- Карточки авторов, кластеризация и сравнение авторов/депо/воркспейсов
- Общий фильтр по депо/воркспейсам/расширениям, применяемый сразу ко всем разделам
- Экспорт в PDF и CSV — по каждому графику отдельно и «всё разом»

## Стек

| Слой | Технологии |
|---|---|
| Backend | Java 17, Spring Boot 3.2.5, P4Java, Spring AMQP (RabbitMQ), Lombok |
| Аналитика | Python 3, pandas, numpy, scikit-learn, scipy, mlxtend, pika |
| Дашборд | Vanilla JS, Chart.js, jsPDF |
| Инфраструктура | RabbitMQ (Docker) |

## Структура проекта

```
├── backend/                  # Java Spring Boot приложение
│   └── perforce_stats_analyzer/
│       ├── PerforceStatsAnalyzerApplication.java
│       ├── PerforceChangelistFetcher.java   # подключение к Perforce, сбор чейнджлистов
│       ├── AnalyticsController.java         # REST API для дашборда
│       ├── RabbitConfig.java
│       ├── ChangelistTransaction.java       # DTO сабмита
│       ├── AnalyticsRequestMessage.java     # сообщение в очередь
│       └── AnalyticsFilterRequest.java      # тело запроса фильтра
│
├── analyzer/                  # Python-пайплайн аналитики
│   ├── rabbit_consumer.py             # слушает очередь, вызывает пайплайн
│   ├── analytics_pipeline.py          # точка входа, собирает report.json
│   ├── feature_extractor.py           # сырые сабмиты -> числовые признаки
│   ├── feature_cleaner.py             # чистка сильно скоррелированных признаков
│   ├── statistics_pipeline.py
│   ├── correlation_analyzer.py
│   ├── anomaly_detector.py / anomaly_detection_pipeline.py
│   ├── clustering_pipeline.py / clustering_runner.py / clustering_utils.py
│   ├── prepare_clustering_data.py
│   └── apriori_runner.py
│
└── dashboard1/                 # Дашборд (статический HTML/JS/CSS)
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── data.js              # построение внутренней структуры из сырых коммитов
        ├── global-filter.js      # общий фильтр по всем разделам
        ├── charts/                # графики (heatmap, авторы, файлы, тренд...)
        ├── sections/              # разделы (аномалии, apriori, bus factor...)
        └── lib/                   # переиспользуемые компоненты (пикеры, статистика)
```

## Запуск

Нужны три отдельных процесса одновременно.

### 1. RabbitMQ

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

Панель управления: `http://localhost:15672` (логин/пароль по умолчанию `guest`/`guest`).

### 2. Python-консьюмер

```bash
cd analyzer
pip install pandas numpy scikit-learn scipy mlxtend pika --break-system-packages
python -c "from rabbit_consumer import start_consuming; start_consuming()"
```

Должно вывести `[INFO] Подключено к RabbitMQ, очередь: analyzer.queue`. Процесс держать запущенным — это долгоживущий слушатель очереди.

### 3. Java-приложение

```bash
cd backend
mvn spring-boot:run
```

При старте автоматически подключается к Perforce, забирает все чейнджлисты и кладёт в очередь. Поднимает REST API на порту 8080.

### 4. Дашборд

Проще всего — положить содержимое `dashboard1/` в `backend/src/main/resources/static/`, тогда он откроется на `http://localhost:8080/index.html` без проблем с CORS (тот же origin, что и API).

Либо отдельным статическим сервером — тогда в `index.html` нужно указать `window.ANALYTICS_API_BASE` явно, если Java слушает не на `localhost:8080`.

## API

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/commits` | Сырые чейнджлисты (кэш последнего сбора из Perforce) |
| `POST` | `/api/analytics/recalculate` | Пересчёт аналитики. Тело: `{ "periodFrom": "YYYY-MM-DD", "periodTo": "YYYY-MM-DD" }` (оба поля опциональны) |

Ответ `POST /api/analytics/recalculate` идёт через RabbitMQ (RPC, `reply_to`/`correlation_id`) — Python считает и отвечает синхронно в рамках одного HTTP-запроса.

## Известные ограничения

- Живой пересчёт по фильтру периода поддерживается; фильтрация по депо/воркспейсу/автору на уровне ML-разделов (аномалии/кластеризация) — это «показ подмножества уже посчитанного», а не пересчёт с нуля (сам расчёт учитывает все данные разом).
- При малом числе сущностей (меньше 3 авторов/депо/воркспейсов) агрегированные уровни аномалий и кластеризации не считаются — дашборд показывает сообщение о нехватке данных, а не пустоту.
- Учётные данные Perforce сейчас заданы в коде (`PerforceChangelistFetcher`) — для реального использования стоит вынести в `application.properties`/переменные окружения.
