import pandas as pd
import numpy as np
from datetime import datetime


def prepare_data_with_metadata(data: list, numeric_records: list) -> pd.DataFrame:
    meta = []
    for idx, item in enumerate(data):
        user = item.get('username')
        raw_dt = item.get('date')
        depots = item.get('depotNames') or []
        workspace = item.get('clientId')
        if isinstance(raw_dt, str):
            dt = datetime.fromisoformat(raw_dt.replace('Z', '+00:00')).timestamp() * 1000
        elif raw_dt:
            dt = raw_dt
        else:
            dt = None
        day = datetime.fromtimestamp(dt / 1000).date() if dt else None
        meta.append({
            'idx': idx,
            'user': user,
            'date': dt,
            'day': day,
            'depots': depots,
            'workspace': workspace,
        })

    meta_df = pd.DataFrame(meta)
    num_df = pd.DataFrame(numeric_records)
    full_df = pd.concat([meta_df, num_df], axis=1)
    return full_df


def _numeric_cols(df: pd.DataFrame) -> list:
    meta = {'idx', 'user', 'date', 'day', 'depots', 'depot', 'workspace'}
    return [c for c in df.columns if c not in meta]


def aggregate_by_user(full_df: pd.DataFrame) -> pd.DataFrame:
    num_cols = _numeric_cols(full_df)
    agg = full_df.groupby('user').agg(
        {**{col: ['mean', 'std', 'count'] for col in num_cols},
         'date': ['count', 'std'],
         'day': lambda x: x.nunique()}
    )
    agg.columns = ['_'.join(col).strip() for col in agg.columns]
    return agg.reset_index()


def aggregate_by_day(full_df: pd.DataFrame) -> pd.DataFrame:
    num_cols = _numeric_cols(full_df)
    agg = full_df.groupby('day').agg(
        {col: ['mean', 'sum'] for col in num_cols}
    )
    agg.columns = ['_'.join(col).strip() for col in agg.columns]
    agg['unique_users'] = full_df.groupby('day')['user'].nunique()
    return agg.reset_index()


def aggregate_by_depot(full_df: pd.DataFrame) -> pd.DataFrame:
    df_exploded = full_df.copy()
    df_exploded = df_exploded.explode('depots').rename(columns={'depots': 'depot'})
    df_exploded = df_exploded.dropna(subset=['depot'])

    num_cols = _numeric_cols(df_exploded)
    agg = df_exploded.groupby('depot').agg(
        {col: ['mean', 'std', 'sum'] for col in num_cols}
    )
    agg.columns = ['_'.join(col).strip() for col in agg.columns]
    agg['unique_users'] = df_exploded.groupby('depot')['user'].nunique()
    return agg.reset_index()


def aggregate_by_workspace(full_df: pd.DataFrame) -> pd.DataFrame:
    df_ws = full_df.dropna(subset=['workspace'])
    if df_ws.empty:
        return pd.DataFrame()

    num_cols = _numeric_cols(df_ws)
    agg = df_ws.groupby('workspace').agg(
        {col: ['mean', 'std', 'sum'] for col in num_cols}
    )
    agg.columns = ['_'.join(col).strip() for col in agg.columns]
    agg['unique_users'] = df_ws.groupby('workspace')['user'].nunique()
    return agg.reset_index()


def aggregate_user_project(full_df: pd.DataFrame) -> pd.DataFrame:
    df_exploded = full_df.copy()
    df_exploded = df_exploded.explode('depots').rename(columns={'depots': 'depot'})
    df_filtered = df_exploded.dropna(subset=['user', 'depot'])

    if df_filtered.empty:
        return pd.DataFrame()

    num_cols = _numeric_cols(df_filtered)
    agg = df_filtered.groupby(['user', 'depot']).agg(
        {**{col: ['mean', 'std', 'count'] for col in num_cols},
         'date': ['count', 'std'],
         'day': lambda x: x.nunique()}
    )
    agg.columns = ['_'.join(col).strip() for col in agg.columns]
    return agg.reset_index()


def build_file_type_matrix(data: list, numeric_records: list) -> pd.DataFrame:
    from sklearn.preprocessing import MultiLabelBinarizer
    file_types = [item.get('fileTypes', []) for item in data]
    mlb = MultiLabelBinarizer()
    type_matrix = mlb.fit_transform(file_types)
    return pd.DataFrame(type_matrix, columns=mlb.classes_)
