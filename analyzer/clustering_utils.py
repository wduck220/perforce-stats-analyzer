import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from clustering_runner import run_kmeans, run_dbscan, clustering_summary, visualize_clusters


def run_clustering_on_df(df: pd.DataFrame, method: str = 'kmeans', n_clusters: int = None,
                         eps: float = 0.5, min_samples: int = 5,
                         visualize: bool = True, title: str = None) -> tuple:
    if len(df) < 3:
        print(f"[Ошибка] Мало объектов для кластеризации: {len(df)}")
        return None, None

    df_clean = df.loc[:, df.nunique() > 1].dropna()

    if df_clean.empty or df_clean.shape[1] < 2:
        print("[Ошибка] Недостаточно признаков после очистки.")
        return None, None

    if len(df_clean) < 3:
        print(f"[Ошибка] После удаления NaN осталось {len(df_clean)} объектов.")
        return None, None

    feature_names = df_clean.columns.tolist()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_clean)

    if method == 'kmeans':
        labels, centers, _ = run_kmeans(X_scaled, n_clusters)
        centers_original = scaler.inverse_transform(centers)
        summary = clustering_summary(labels, 'kmeans', centers=centers_original,
                                     feature_names=feature_names, X=X_scaled)
        extra = {**summary, 'feature_names': feature_names, 'row_index': df_clean.index.tolist()}
        if visualize and title:
            visualize_clusters(X_scaled, labels, title=title)
        return labels, extra

    if method == 'dbscan':
        labels, n_cls, n_noise = run_dbscan(X_scaled, eps, min_samples)
        summary = clustering_summary(labels, 'dbscan', X=X_scaled)
        extra = {**summary, 'n_noise': n_noise, 'row_index': df_clean.index.tolist()}
        if visualize and title:
            visualize_clusters(X_scaled, labels, title=title)
        return labels, extra

    print(f"[Ошибка] Неизвестный метод: {method}")
    return None, None


def labels_to_assignments(labels, id_values, id_key: str) -> list:
    return [
        {id_key: (str(val) if not isinstance(val, (int, float, bool)) else val), 'cluster': int(lbl)}
        for val, lbl in zip(id_values, labels)
    ]
