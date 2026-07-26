from anomaly_detector import detect_anomalies, build_anomaly_report, build_aggregate_anomaly_report
from prepare_clustering_data import (
    aggregate_by_user,
    aggregate_by_day,
    aggregate_by_depot,
    aggregate_by_workspace,
    prepare_data_with_metadata,
)


def run_anomaly_detection_pipeline(
    data: list,
    numeric_records: list,
    levels: list = None,
    iqr_factor: float = 1.5,
    z_threshold: float = 3,
    if_contamination: float = 0.05,
    lof_neighbors: int = 20,
    lof_contamination: float = 0.05,
    vote_threshold: int = 2,
    max_submit_details: int = None,
) -> dict:
    if levels is None:
        levels = ['submits', 'users', 'days', 'depots', 'workspaces']

    results = {}
    detect_kwargs = dict(
        iqr_factor=iqr_factor,
        z_threshold=z_threshold,
        if_contamination=if_contamination,
        lof_neighbors=lof_neighbors,
        lof_contamination=lof_contamination,
        vote_threshold=vote_threshold,
    )

    full_df = None
    if set(levels) & {'users', 'days', 'depots', 'workspaces'}:
        full_df = prepare_data_with_metadata(data, numeric_records)
        if full_df is None:
            print("[Предупреждение] Не удалось подготовить данные для агрегации.")
            levels = [l for l in levels if l == 'submits']

    if 'submits' in levels:
        mask, summary, per_item_votes = detect_anomalies(numeric_records, **detect_kwargs)
        if mask is not None:
            commit_ids = [item.get('changeListId') for item in data]
            report = build_anomaly_report(
                numeric_records, mask, per_item_votes=per_item_votes,
                max_details=max_submit_details, commit_ids=commit_ids,
            )
            results['submits'] = {**summary, **report, 'anomaly_indices': mask[mask].index.tolist()}

    if 'users' in levels and full_df is not None:
        user_df = aggregate_by_user(full_df)
        if len(user_df) >= 3:
            records = user_df.drop(columns=['user']).to_dict('records')
            mask, summary, per_item_votes = detect_anomalies(records, **detect_kwargs)
            if mask is not None:
                agg_report = build_aggregate_anomaly_report(
                    records, mask, user_df['user'], 'user', per_item_votes=per_item_votes,
                )
                results['users'] = {
                    **summary,
                    **agg_report,
                    'anomalous_users': user_df.loc[mask.values, 'user'].tolist(),
                }

    if 'days' in levels and full_df is not None:
        day_df = aggregate_by_day(full_df)
        if len(day_df) >= 3:
            records = day_df.drop(columns=['day']).to_dict('records')
            mask, summary, per_item_votes = detect_anomalies(records, **detect_kwargs)
            if mask is not None:
                day_labels = [str(d) for d in day_df['day']]
                agg_report = build_aggregate_anomaly_report(
                    records, mask, day_labels, 'day', per_item_votes=per_item_votes,
                )
                results['days'] = {
                    **summary,
                    **agg_report,
                    'anomalous_days': [str(d) for d in day_df.loc[mask.values, 'day'].tolist()],
                }

    if 'depots' in levels and full_df is not None:
        depot_df = aggregate_by_depot(full_df)
        if len(depot_df) >= 3:
            records = depot_df.drop(columns=['depot']).to_dict('records')
            mask, summary, per_item_votes = detect_anomalies(records, **detect_kwargs)
            if mask is not None:
                agg_report = build_aggregate_anomaly_report(
                    records, mask, depot_df['depot'], 'depot', per_item_votes=per_item_votes,
                )
                results['depots'] = {
                    **summary,
                    **agg_report,
                    'anomalous_depots': depot_df.loc[mask.values, 'depot'].tolist(),
                }

    if 'workspaces' in levels and full_df is not None:
        workspace_df = aggregate_by_workspace(full_df)
        if len(workspace_df) >= 3:
            records = workspace_df.drop(columns=['workspace']).to_dict('records')
            mask, summary, per_item_votes = detect_anomalies(records, **detect_kwargs)
            if mask is not None:
                agg_report = build_aggregate_anomaly_report(
                    records, mask, workspace_df['workspace'], 'workspace', per_item_votes=per_item_votes,
                )
                results['workspaces'] = {
                    **summary,
                    **agg_report,
                    'anomalous_workspaces': workspace_df.loc[mask.values, 'workspace'].tolist(),
                }

    return results
