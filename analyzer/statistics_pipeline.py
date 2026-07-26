import pandas as pd
import numpy as np
from collections import Counter
from datetime import datetime


def _normalize_text(text):
    if isinstance(text, str):
        return text.lower().strip().rstrip(';., ')
    return text


def run_statistics_pipeline(data: list, numeric_records: list) -> dict:
    df_num = pd.DataFrame(numeric_records)
    result = {}

    result['overview'] = {
        'total_submits': len(df_num),
        'numeric_features': df_num.shape[1],
        'nan_count': int(df_num.isna().sum().sum()),
    }

    numeric_stats = {}
    if not df_num.empty:
        for col in df_num.columns:
            std = df_num[col].std()
            mean = df_num[col].mean()
            q1 = df_num[col].quantile(0.25)
            q3 = df_num[col].quantile(0.75)
            numeric_stats[col] = {
                'mean': round(float(mean), 4),
                'std': round(float(std), 4),
                'min': round(float(df_num[col].min()), 4),
                'max': round(float(df_num[col].max()), 4),
                'q25': round(float(q1), 4),
                'q50': round(float(df_num[col].median()), 4),
                'q75': round(float(q3), 4),
                'iqr': round(float(q3 - q1), 4),
                'skew': round(float(df_num[col].skew()), 4),
                'kurtosis': round(float(df_num[col].kurtosis()), 4),
                'cv_pct': round(float(std / mean * 100), 2) if mean != 0 else None,
            }
    result['numeric'] = numeric_stats

    cat_stats = {}
    if data:
        sample = data[0]
        cat_keys = [
            k for k in sample.keys()
            if isinstance(sample.get(k), (str, bool, list))
        ]
        for key in cat_keys:
            values = [item.get(key) for item in data if key in item]
            if values and isinstance(values[0], list):
                flat = []
                for v in values:
                    if v:
                        flat.extend(v)
                values = flat
            if values and isinstance(values[0], str):
                values = [_normalize_text(v) for v in values if v is not None]
            else:
                values = [v for v in values if v is not None]
            if not values:
                continue
            freq = Counter(values).most_common(10)
            total = len(values)
            cat_stats[key] = {
                'unique_count': len(set(values)),
                'total_count': total,
                'top10': [{'value': str(v), 'count': c, 'pct': round(c / total * 100, 2)} for v, c in freq],
            }
    result['categorical'] = cat_stats

    time_stats = {}
    dates = [item.get('date') for item in data if isinstance(item.get('date'), (int, float))]
    if dates:
        dt_series = pd.to_datetime(dates, unit='ms')
        dt_list = dt_series.tolist()
        hours = dt_series.hour.tolist()
        weekdays = dt_series.day_name().tolist()
        hour_counts = Counter(hours)
        weekday_counts = Counter(weekdays)
        time_stats = {
            'period_from': str(min(dt_list).date()),
            'period_to': str(max(dt_list).date()),
            'total_days': (max(dt_list) - min(dt_list)).days,
            'top_hours': [
                {'hour': h, 'count': c, 'pct': round(c / len(dates) * 100, 2)}
                for h, c in hour_counts.most_common(5)
            ],
            'by_weekday': [
                {'weekday': w, 'count': c, 'pct': round(c / len(dates) * 100, 2)}
                for w, c in weekday_counts.most_common(7)
            ],
        }
    result['time'] = time_stats

    return result
