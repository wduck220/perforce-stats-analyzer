from collections import Counter
import numpy as np
from datetime import datetime


def categorize_by_percentiles(items, elements, prefix, global_percentiles=None):
    counter = Counter(items)
    if not counter:
        return

    if global_percentiles:
        q25 = global_percentiles['q25']
        q50 = global_percentiles['q50']
        q75 = global_percentiles['q75']
    else:
        counts = list(counter.values())
        if len(counts) == 1:
            value = list(counter.keys())[0]
            elements.append(f"{prefix}:{value}:single")
            return
        q25 = np.percentile(counts, 25)
        q50 = np.percentile(counts, 50)
        q75 = np.percentile(counts, 75)

    for value, cnt in counter.items():
        if cnt <= q25:
            cat = 'low'
        elif cnt <= q50:
            cat = 'medium-low'
        elif cnt <= q75:
            cat = 'medium-high'
        else:
            cat = 'high'
        elements.append(f"{prefix}:{value}:{cat}")


def compute_global_percentiles(all_items):
    counter = Counter(all_items)
    counts = list(counter.values())
    if len(counts) < 2:
        return None
    return {
        'q25': np.percentile(counts, 25),
        'q50': np.percentile(counts, 50),
        'q75': np.percentile(counts, 75),
    }


def categorize_desc_length(description, elements):
    desc_len = len(description)
    if desc_len < 10:
        elements.append("desc:short")
    elif desc_len < 100:
        elements.append("desc:medium")
    elif desc_len < 1000:
        elements.append("desc:long")
    else:
        elements.append("desc:very_long")


def add_numeric_category(value, elements, prefix, thresholds, labels):
    for i, th in enumerate(thresholds):
        if value < th:
            elements.append(f"{prefix}:{labels[i]}")
            return
    elements.append(f"{prefix}:{labels[-1]}")


def categorize_time_by_day(elements, dt):
    hour = dt.hour
    if hour < 6:
        elements.append("time:night")
    elif hour < 12:
        elements.append("time:morning")
    elif hour < 18:
        elements.append("time:afternoon")
    else:
        elements.append("time:evening")


def categorize_submit_delta(delta_hours):
    if delta_hours < 1:
        return "since:<1h"
    elif delta_hours < 10:
        return "since:1-10h"
    elif delta_hours < 24:
        return "since:10-24h"
    elif delta_hours < 48:
        return "since:1-2d"
    elif delta_hours < 168:
        return "since:1w"
    elif delta_hours < 336:
        return "since:2w"
    elif delta_hours < 720:
        return "since:1m"
    else:
        return "since:>1m"


def convert_timestamp(ts_ms):
    dt = datetime.fromtimestamp(ts_ms / 1000.0)
    return {
        "iso": dt.isoformat(),
        "year": dt.year,
        "month": dt.month,
        "day": dt.day,
        "hour": dt.hour,
        "minute": dt.minute,
        "second": dt.second,
        "weekday": dt.strftime("%A"),
        "weekday_short": dt.strftime("%a"),
        "date_string": dt.strftime("%Y-%m-%d %H:%M:%S")
    }
