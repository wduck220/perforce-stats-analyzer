import pandas as pd
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import os


def prepare_data(numeric_records: list) -> tuple:
    df = pd.DataFrame(numeric_records)
    df = df.loc[:, df.nunique() > 1]
    if df.empty or df.shape[1] < 2:
        return None, None, None
    initial_len = len(df)
    df = df.dropna()
    dropped = initial_len - len(df)
    if dropped:
        print(f"[prepare_data] Удалено строк с NaN: {dropped}")
    feature_names = df.columns.tolist()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df)
    return X_scaled, feature_names, scaler


def run_kmeans(X: np.ndarray, n_clusters: int = None, random_state: int = 42,
               silhouette_sample_size: int = 2000) -> tuple:
    best_score = -1

    if n_clusters is None:
        best_k = 2
        for k in range(2, min(7, X.shape[0])):
            try:
                labels = KMeans(n_clusters=k, random_state=random_state, n_init=10).fit_predict(X)
                score = silhouette_score(X, labels, sample_size=min(silhouette_sample_size, X.shape[0]), random_state=random_state)
                if score > best_score:
                    best_score = score
                    best_k = k
            except Exception as e:
                print(f"[K-Means] K={k} не удалось: {e}")
        n_clusters = best_k
        print(f"[K-Means] Оптимальное K={n_clusters} (силуэт={best_score:.3f})")
    else:
        try:
            labels = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10).fit_predict(X)
            best_score = silhouette_score(X, labels, sample_size=min(silhouette_sample_size, X.shape[0]), random_state=random_state)
        except Exception as e:
            print(f"[K-Means] Ошибка при K={n_clusters}: {e}")
        print(f"[K-Means] K={n_clusters}, силуэт={best_score:.3f}")

    kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    labels = kmeans.fit_predict(X)
    return labels, kmeans.cluster_centers_, best_score


def run_dbscan(X: np.ndarray, eps: float = 0.5, min_samples: int = 5) -> tuple:
    labels = DBSCAN(eps=eps, min_samples=min_samples).fit_predict(X)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = int((labels == -1).sum())
    print(f"[DBSCAN] Кластеров: {n_clusters}, шума: {n_noise}")
    return labels, n_clusters, n_noise


def clustering_summary(labels: np.ndarray, method: str, centers=None,
                       feature_names=None, X=None) -> dict:
    unique, counts = np.unique(labels, return_counts=True)
    n_samples = len(labels)

    result = {
        'method': method,
        'n_clusters': int(len(unique) - (1 if -1 in unique else 0)),
        'distribution': [
            {'cluster': int(c), 'count': int(cnt), 'pct': round(cnt / n_samples * 100, 1)}
            for c, cnt in zip(unique, counts)
        ],
    }

    if method == 'kmeans' and centers is not None and feature_names is not None:
        result['centers'] = [
            {name: round(float(val), 4) for name, val in zip(feature_names, center)}
            for center in centers
        ]

    if X is not None and len(set(labels)) > 1:
        try:
            if method == 'dbscan' and -1 in labels:
                mask = labels != -1
                if len(set(labels[mask])) > 1:
                    result['silhouette'] = round(float(silhouette_score(X[mask], labels[mask])), 3)
            else:
                result['silhouette'] = round(float(silhouette_score(X, labels)), 3)
        except Exception:
            pass

    return result


def visualize_clusters(X_scaled: np.ndarray, labels: np.ndarray,
                       title: str = "Кластеры", save_dir: str = "plots"):
    if len(set(labels)) < 2:
        return

    os.makedirs(save_dir, exist_ok=True)
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    n_clusters = len(set(labels))
    cmap = 'viridis' if n_clusters <= 10 else 'tab20'

    plt.figure(figsize=(8, 6))
    scatter = plt.scatter(X_pca[:, 0], X_pca[:, 1], c=labels, cmap=cmap, s=30, alpha=0.7)
    plt.title(title)
    plt.xlabel('PC1')
    plt.ylabel('PC2')
    plt.colorbar(scatter, ticks=range(n_clusters), label='Кластер')

    filename = title.replace(' ', '_').replace('×', 'x') + '.png'
    filepath = os.path.join(save_dir, filename)
    plt.savefig(filepath, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"[visualize] Сохранён: {filepath}")


def run_clustering(numeric_records: list, method: str = 'kmeans',
                   n_clusters: int = None, eps: float = 0.5,
                   min_samples: int = 5, visualize: bool = True) -> tuple:
    X, feature_names, scaler = prepare_data(numeric_records)
    if X is None:
        print("[Ошибка] Недостаточно данных для кластеризации.")
        return None, None

    if method == 'kmeans':
        labels, centers, silhouette = run_kmeans(X, n_clusters)
        centers_original = scaler.inverse_transform(centers)
        summary = clustering_summary(labels, 'kmeans', centers=centers_original,
                                     feature_names=feature_names, X=X)
        extra = {**summary, 'feature_names': feature_names}
        if visualize:
            visualize_clusters(X, labels, title="K-Means кластеры сабмитов")
        return labels, extra

    if method == 'dbscan':
        labels, n_cls, n_noise = run_dbscan(X, eps, min_samples)
        summary = clustering_summary(labels, 'dbscan', X=X)
        extra = {**summary, 'n_noise': n_noise, 'eps': eps, 'min_samples': min_samples}
        if visualize:
            visualize_clusters(X, labels, title="DBSCAN кластеры сабмитов")
        return labels, extra

    print(f"[Ошибка] Неизвестный метод: {method}")
    return None, None
