from preprocessor import (
    categorize_by_percentiles,
    compute_global_percentiles,
    categorize_desc_length,
    add_numeric_category,
    categorize_time_by_day,
    categorize_submit_delta,
)
from datetime import datetime
import numpy as np

def _collect_global_percentiles(data):
    all_extensions = []
    all_depot_names = []
    all_actions = []
    all_file_types = []

    for item in data:
        if 'filenames' in item:
            for fname in item['filenames']:
                if '.' in fname:
                    all_extensions.append(fname.split('.')[-1])
        if 'depotNames' in item:
            all_depot_names.extend(item['depotNames'])
        if 'fileActions' in item:
            all_actions.extend(item['fileActions'])
        if 'fileTypes' in item:
            all_file_types.extend(item['fileTypes'])

    return {
        'ext': compute_global_percentiles(all_extensions),
        'depot': compute_global_percentiles(all_depot_names),
        'op': compute_global_percentiles(all_actions),
        'file_type': compute_global_percentiles(all_file_types),
    }

def extract_features(data):

    def _date_sort_key(item):
        d = item.get('date', 0)
        if isinstance(d, (int, float)):
            return d
        if isinstance(d, str):
            try:
                return datetime.fromisoformat(d.replace('Z', '+00:00')).timestamp() * 1000
            except ValueError:
                return 0
        return 0

    data_sorted = sorted(data, key=_date_sort_key)

    global_percentiles = _collect_global_percentiles(data_sorted)

    numeric_records = []
    transactions = []
    last_submit = {}

    for item in data_sorted:
        numeric = {}
        elements = []

        username = item.get('username')
        if username:
            elements.append(f"user:{username}")

        if 'clientId' in item:
            elements.append(f"client_id:{item['clientId']}")

        if 'changeListStatus' in item:
            elements.append(f"status:{item['changeListStatus']}")

        if 'filenames' in item:
            fnames = item['filenames']
            numeric['file_count'] = len(fnames)
            extensions = [f.split('.')[-1] for f in fnames if '.' in f]
            if extensions:
                numeric['unique_ext_count'] = len(set(extensions))
                numeric['avg_filename_len'] = float(np.mean([len(f) for f in fnames]))
            categorize_by_percentiles(extensions, elements, prefix="ext",
                                      global_percentiles=global_percentiles['ext'])

        if 'date' in item and isinstance(item['date'], (int, float)):
            dt = datetime.fromtimestamp(item['date'] / 1000.0)
            numeric['hour'] = dt.hour
            numeric['weekday'] = dt.weekday()
            numeric['is_weekend'] = 1 if dt.weekday() >= 5 else 0

            elements.append(f"hour:{dt.hour}")
            elements.append(f"weekday:{dt.strftime('%A')}")
            categorize_time_by_day(elements, dt)

            if username:
                if username not in last_submit:
                    elements.append("since:first")
                else:
                    delta_hours = (dt - last_submit[username]).total_seconds() / 3600.0
                    elements.append(categorize_submit_delta(delta_hours))
                    numeric['hours_since_last'] = delta_hours
                last_submit[username] = dt

        if 'depotNames' in item:
            depots = item['depotNames']
            numeric['depot_count'] = len(depots)
            numeric['depot_unique'] = len(set(depots))
            categorize_by_percentiles(depots, elements, prefix="depot",
                                      global_percentiles=global_percentiles['depot'])

        if 'sizes' in item:
            sizes = item['sizes']
            total = sum(sizes)
            numeric['total_size'] = total
            numeric['avg_size'] = float(np.mean(sizes))
            numeric['max_size'] = max(sizes)
            numeric['file_count'] = len(sizes)
            if total > 0:
                numeric['max_size_ratio'] = max(sizes) / total

            add_numeric_category(total, elements, 'total_size',
                                 thresholds=[10240, 1048576, 10485760],
                                 labels=['tiny', 'small', 'medium', 'large'])
            add_numeric_category(numeric['avg_size'], elements, 'avg_size',
                                 thresholds=[1024, 1048576, 10485760],
                                 labels=['tiny', 'small', 'medium', 'large'])
            add_numeric_category(max(sizes), elements, 'max_size',
                                 thresholds=[1024, 1048576],
                                 labels=['tiny', 'small', 'large'])

        if 'description' in item:
            numeric['desc_length'] = len(item['description'])
            categorize_desc_length(item['description'], elements)

        if 'fileActions' in item:
            actions = item['fileActions']
            numeric['action_count'] = len(actions)
            numeric['action_unique'] = len(set(actions))
            if numeric['action_count'] > 0:
                numeric['action_unique_ratio'] = numeric['action_unique'] / numeric['action_count']
            categorize_by_percentiles(actions, elements, prefix="op",
                                      global_percentiles=global_percentiles['op'])

        if 'fileTypes' in item:
            types = item['fileTypes']
            numeric['type_count'] = len(types)
            numeric['type_unique'] = len(set(types))
            if numeric['type_count'] > 0:
                numeric['type_unique_ratio'] = numeric['type_unique'] / numeric['type_count']
            categorize_by_percentiles(types, elements, prefix="file_type",
                                      global_percentiles=global_percentiles['file_type'])

        if 'fileRevisions' in item:
            revs = item['fileRevisions']
            avg_rev = float(np.mean(revs))
            max_rev = max(revs)
            new_ratio = sum(1 for r in revs if r == 1) / len(revs)

            numeric['avg_rev'] = avg_rev
            numeric['max_rev'] = max_rev
            numeric['new_ratio'] = new_ratio

            add_numeric_category(avg_rev, elements, 'rev_avg',
                                 thresholds=[2, 5, 20],
                                 labels=['very_low', 'low', 'medium', 'high'])
            add_numeric_category(max_rev, elements, 'rev_max',
                                 thresholds=[5, 50],
                                 labels=['low', 'medium', 'high'])
            add_numeric_category(new_ratio, elements, 'rev_new',
                                 thresholds=[0.3, 0.7],
                                 labels=['few', 'some', 'dominant'])

        if numeric:
            numeric_records.append(numeric)
        if elements:
            transactions.append(elements)

    return numeric_records, transactions, data_sorted