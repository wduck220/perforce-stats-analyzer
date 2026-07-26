import pandas as pd
from prepare_clustering_data import (
    prepare_data_with_metadata,
    aggregate_by_user,
    aggregate_by_day,
    aggregate_by_depot,
    aggregate_by_workspace,
    aggregate_user_project,
    build_file_type_matrix,
)
from clustering_utils import run_clustering_on_df, labels_to_assignments


def _assign_clusters(df: pd.DataFrame, labels, row_index) -> pd.DataFrame:
    out = df.copy()
    out['cluster'] = pd.NA
    out.loc[row_index, 'cluster'] = labels
    return out


def run_clustering_pipeline(data: list, numeric_records: list, visualize: bool = True) -> dict:
    results = {}

    full_df = prepare_data_with_metadata(data, numeric_records)
    if full_df is None or full_df.empty:
        print("[Ошибка] Нет данных для кластеризации.")
        return results

    df_submits = pd.DataFrame(numeric_records)
    if len(df_submits) >= 3:
        labels, extra = run_clustering_on_df(
            df_submits, method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры сабмитов"
        )
        if labels is not None:
            extra['assignments'] = labels_to_assignments(labels, extra['row_index'], 'submit_index')
            results['submits'] = extra

    user_df = aggregate_by_user(full_df)
    if len(user_df) >= 3:
        labels, extra = run_clustering_on_df(
            user_df.drop(columns=['user']), method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры пользователей"
        )
        if labels is not None:
            user_df = _assign_clusters(user_df, labels, extra['row_index'])
            extra['cluster_means'] = user_df.dropna(subset=['cluster']).groupby('cluster').mean(numeric_only=True).round(2).to_dict()
            extra['assignments'] = [
                {'user': row['user'], 'cluster': int(row['cluster'])}
                for _, row in user_df.dropna(subset=['cluster']).iterrows()
            ]
            results['users'] = extra

    day_df = aggregate_by_day(full_df)
    if len(day_df) >= 3:
        labels, extra = run_clustering_on_df(
            day_df.drop(columns=['day']), method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры дней"
        )
        if labels is not None:
            day_df = _assign_clusters(day_df, labels, extra['row_index'])
            extra['cluster_means'] = day_df.dropna(subset=['cluster']).groupby('cluster').mean(numeric_only=True).round(2).to_dict()
            extra['assignments'] = [
                {'day': str(row['day']), 'cluster': int(row['cluster'])}
                for _, row in day_df.dropna(subset=['cluster']).iterrows()
            ]
            results['days'] = extra

    depot_df = aggregate_by_depot(full_df)
    if len(depot_df) >= 3:
        labels, extra = run_clustering_on_df(
            depot_df.drop(columns=['depot']), method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры депо"
        )
        if labels is not None:
            depot_df = _assign_clusters(depot_df, labels, extra['row_index'])
            extra['cluster_means'] = depot_df.dropna(subset=['cluster']).groupby('cluster').mean(numeric_only=True).round(2).to_dict()
            extra['assignments'] = [
                {'depot': row['depot'], 'cluster': int(row['cluster'])}
                for _, row in depot_df.dropna(subset=['cluster']).iterrows()
            ]
            results['depots'] = extra

    workspace_df = aggregate_by_workspace(full_df)
    if len(workspace_df) >= 3:
        labels, extra = run_clustering_on_df(
            workspace_df.drop(columns=['workspace']), method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры воркспейсов"
        )
        if labels is not None:
            workspace_df = _assign_clusters(workspace_df, labels, extra['row_index'])
            extra['cluster_means'] = workspace_df.dropna(subset=['cluster']).groupby('cluster').mean(numeric_only=True).round(2).to_dict()
            extra['assignments'] = [
                {'workspace': row['workspace'], 'cluster': int(row['cluster'])}
                for _, row in workspace_df.dropna(subset=['cluster']).iterrows()
            ]
            results['workspaces'] = extra

    up_df = aggregate_user_project(full_df)
    if len(up_df) >= 3:
        labels, extra = run_clustering_on_df(
            up_df.drop(columns=['user', 'depot']), method='kmeans', n_clusters=None,
            visualize=visualize, title="Кластеры пользователи x проекты"
        )
        if labels is not None:
            up_df = _assign_clusters(up_df, labels, extra['row_index'])
            extra['assignments'] = [
                {'user': row['user'], 'depot': row['depot'], 'cluster': int(row['cluster'])}
                for _, row in up_df.dropna(subset=['cluster']).iterrows()
            ]
            results['user_project'] = extra

    df_types = build_file_type_matrix(data, numeric_records)
    if len(df_types) >= 3:
        df_types = df_types.loc[:, df_types.nunique() > 1]
        if df_types.shape[1] >= 2:
            labels, extra = run_clustering_on_df(
                df_types, method='kmeans', n_clusters=None,
                visualize=visualize, title="Кластеры типы файлов"
            )
            if labels is not None:
                extra['assignments'] = labels_to_assignments(labels, extra['row_index'], 'submit_index')
                results['file_types'] = extra

    return results
