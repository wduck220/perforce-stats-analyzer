import json
import math
from datetime import datetime
from pathlib import Path

import pandas as pd

from feature_extractor import extract_features
from feature_cleaner import FeatureCleaner
from statistics_pipeline import run_statistics_pipeline
from anomaly_detection_pipeline import run_anomaly_detection_pipeline
from clustering_pipeline import run_clustering_pipeline
from apriori_runner import run_apriori
from correlation_analyzer import run_correlation_analysis

def run_analytics_pipeline(
        data: list,
        period_from: str = None,
        period_to: str = None,
        min_support: float = 0.1,
        min_confidence: float = 0.5,
        top_n: int = 50,
        output_path: str = "report.json",
) -> dict:

    if period_from or period_to:
        data = _filter_by_period(data, period_from, period_to)
        if not data:
            print("[Предупреждение] После фильтрации по периоду данных не осталось.")
            return {}

    numeric_records, transactions, data_sorted = extract_features(data)

    if not numeric_records:
        print("[Ошибка] Нет числовых признаков после извлечения.")
        return {}

    # Убираем высококоррелированные признаки
    df_num = pd.DataFrame(numeric_records)
    cleaner = FeatureCleaner(threshold=0.95)
    df_clean = cleaner.fit_transform(df_num)
    numeric_records_clean = df_clean.to_dict('records')

    report = {
        'meta': {
            'generated_at': datetime.now().isoformat(),
            'period_from': period_from,
            'period_to': period_to,
            'total_submits': len(data_sorted),
            'dropped_features': cleaner.get_dropped_info()['dropped'],
        },
        'statistics': run_statistics_pipeline(data_sorted, numeric_records_clean),
        'correlations': run_correlation_analysis(numeric_records_clean, transactions),
        'anomalies': run_anomaly_detection_pipeline(data_sorted, numeric_records_clean),
        'clustering': run_clustering_pipeline(data_sorted, numeric_records_clean, visualize=False),
        'apriori': run_apriori(transactions, min_support, min_confidence, top_n),
    }

    report = sanitize_for_json(report)
    _save_report(report, output_path)
    return report

def _filter_by_period(data: list, period_from: str, period_to: str) -> list:
    fmt = '%Y-%m-%d'
    ts_from = datetime.strptime(period_from, fmt).timestamp() * 1000 if period_from else None
    ts_to = datetime.strptime(period_to, fmt).timestamp() * 1000 if period_to else None

    result = []
    for item in data:
        ts = item.get('date')
        if not isinstance(ts, (int, float)):
            continue
        if ts_from and ts < ts_from:
            continue
        if ts_to and ts > ts_to:
            continue
        result.append(item)
    return result

def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, float) and (math.isinf(obj) or math.isnan(obj)):
        return None
    return obj


def _save_report(report: dict, output_path: str):
    report = sanitize_for_json(report)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"[Report] Сохранён: {output_path}")