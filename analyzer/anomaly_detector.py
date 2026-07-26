import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer


def detect_iqr(df: pd.DataFrame, columns=None, factor: float = 1.5) -> pd.Series:
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns
    outlier_mask = pd.Series(False, index=df.index)
    for col in columns:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        outlier_mask |= (df[col] < q1 - factor * iqr) | (df[col] > q3 + factor * iqr)
    return outlier_mask


def detect_zscore(df: pd.DataFrame, columns=None, threshold: float = 3) -> pd.Series:
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns
    outlier_mask = pd.Series(False, index=df.index)
    for col in columns:
        std = df[col].std()
        if std == 0:
            continue
        z = (df[col] - df[col].mean()) / std
        outlier_mask |= (z.abs() > threshold)
    return outlier_mask


def detect_isolation_forest(df: pd.DataFrame, contamination: float = 0.05) -> pd.Series:
    X = df.select_dtypes(include=[np.number]).values
    X_scaled = StandardScaler().fit_transform(X)
    preds = IsolationForest(contamination=contamination, random_state=42).fit_predict(X_scaled)
    return pd.Series(preds == -1, index=df.index)


def detect_lof(df: pd.DataFrame, n_neighbors: int = 20, contamination: float = 0.05) -> pd.Series:
    X = df.select_dtypes(include=[np.number]).values
    X_scaled = StandardScaler().fit_transform(X)
    preds = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination).fit_predict(X_scaled)
    return pd.Series(preds == -1, index=df.index)


def detect_anomalies(
    numeric_records: list,
    iqr_factor: float = 1.5,
    z_threshold: float = 3,
    if_contamination: float = 0.05,
    lof_neighbors: int = 20,
    lof_contamination: float = 0.05,
    vote_threshold: int = 2,
) -> tuple:
    df = pd.DataFrame(numeric_records)
    df = df.loc[:, df.nunique() > 1]

    if df.empty or len(df) < 3:
        return None, None

    imputer = SimpleImputer(strategy='mean')
    df_imputed = pd.DataFrame(imputer.fit_transform(df), columns=df.columns)

    method_results = {
        'IQR': detect_iqr(df_imputed, factor=iqr_factor),
        'ZScore': detect_zscore(df_imputed, threshold=z_threshold),
        'IsolationForest': detect_isolation_forest(df_imputed, contamination=if_contamination),
        'LOF': detect_lof(df_imputed, n_neighbors=lof_neighbors, contamination=lof_contamination),
    }

    votes = pd.DataFrame(method_results).sum(axis=1)
    final_anomaly = votes >= vote_threshold

    summary = {
        'total': len(df_imputed),
        'anomalies': int(final_anomaly.sum()),
        'per_method': {k: int(v.sum()) for k, v in method_results.items()},
    }
    per_item_votes = {
        str(idx): {name: bool(mask.loc[idx]) for name, mask in method_results.items()}
        for idx in df_imputed.index[final_anomaly]
    }
    return final_anomaly, summary, per_item_votes


def build_anomaly_report(numeric_records: list, anomaly_mask: pd.Series,
                          per_item_votes: dict = None, top_features: int = 5,
                          max_details: int = None, commit_ids: list = None) -> dict:
    df = pd.DataFrame(numeric_records)
    df = df.loc[:, df.nunique() > 1]

    anomalies = df.loc[anomaly_mask]
    normal = df.loc[~anomaly_mask]

    mean_anom = anomalies.mean()
    mean_norm = normal.mean()
    diff = (mean_anom - mean_norm).abs().sort_values(ascending=False)

    top_features_list = []
    for col in diff.head(10).index:
        top_features_list.append({
            'feature': col,
            'anomaly_mean': round(float(mean_anom[col]), 4),
            'normal_mean': round(float(mean_norm[col]), 4),
            'diff': round(float(mean_anom[col] - mean_norm[col]), 4),
        })

    details = []
    normal_std = normal.std()
    normal_std_safe = normal_std.replace(0, np.nan)
    detail_indices = anomalies.index if max_details is None else anomalies.index[:max_details]
    for idx in detail_indices:
        row = anomalies.loc[idx]
        z_scores = ((row - mean_norm) / normal_std_safe).fillna(0)
        top = z_scores.abs().sort_values(ascending=False).head(top_features)
        entry = {
            'index': int(idx),
            'changeListId': commit_ids[idx] if commit_ids is not None and idx < len(commit_ids) else None,
            'deviations': [
                {
                    'feature': feat,
                    'value': round(float(row[feat]), 4),
                    'z_score': round(float(z_scores[feat]), 4),
                    'direction': 'above' if z_scores[feat] > 0 else 'below',
                }
                for feat in top.index
            ]
        }
        if per_item_votes is not None:
            entry['method_votes'] = per_item_votes.get(str(idx), {})
        details.append(entry)

    return {
        'total': len(df),
        'anomaly_count': len(anomalies),
        'anomaly_pct': round(len(anomalies) / len(df) * 100, 2),
        'normal_count': len(normal),
        'top_differing_features': top_features_list,
        'anomaly_details': details,
    }


def build_aggregate_anomaly_report(records: list, anomaly_mask: pd.Series,
                                    id_values, id_key: str,
                                    per_item_votes: dict = None,
                                    top_features: int = 5) -> dict:
    df = pd.DataFrame(records)
    df = df.loc[:, df.nunique() > 1]
    df = df.reset_index(drop=True)
    id_list = list(id_values)

    mask = anomaly_mask.reset_index(drop=True)
    anomalies = df.loc[mask]
    normal = df.loc[~mask]

    mean_anom = anomalies.mean()
    mean_norm = normal.mean()
    diff = (mean_anom - mean_norm).abs().sort_values(ascending=False)

    top_features_list = [
        {
            'feature': col,
            'anomaly_mean': round(float(mean_anom[col]), 4),
            'normal_mean': round(float(mean_norm[col]), 4),
            'diff': round(float(mean_anom[col] - mean_norm[col]), 4),
        }
        for col in diff.head(10).index
    ]

    details = []
    normal_std = normal.std()
    normal_std_safe = normal_std.replace(0, np.nan)
    for idx in anomalies.index:
        row = anomalies.loc[idx]
        z_scores = ((row - mean_norm) / normal_std_safe).fillna(0)
        top = z_scores.abs().sort_values(ascending=False).head(top_features)
        entry = {
            id_key: id_list[idx],
            'deviations': [
                {
                    'feature': feat,
                    'value': round(float(row[feat]), 4),
                    'z_score': round(float(z_scores[feat]), 4),
                    'direction': 'above' if z_scores[feat] > 0 else 'below',
                }
                for feat in top.index
            ],
        }
        if per_item_votes is not None:
            entry['method_votes'] = per_item_votes.get(str(idx), {})
        details.append(entry)

    return {
        'top_differing_features': top_features_list,
        'anomaly_details': details,
    }
