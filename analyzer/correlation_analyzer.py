import pandas as pd
import numpy as np
from scipy.stats import t as t_dist, chi2_contingency


def _get_numeric_df(numeric_records: list) -> pd.DataFrame:
    df = pd.DataFrame(numeric_records)
    return df.loc[:, df.nunique() > 1] if not df.empty else df


def compute_correlations_with_pvalue(numeric_records: list, method: str = 'pearson') -> tuple:
    df = _get_numeric_df(numeric_records)
    if df.empty or df.shape[1] < 2:
        return None, None

    r_matrix = df.corr(method=method).values.copy()

    notnull = (~df.isna()).astype(float).values
    pair_n = notnull.T @ notnull
    dof = np.maximum(pair_n - 2, 1)

    r_safe = r_matrix.copy()
    np.fill_diagonal(r_safe, 0.0)
    with np.errstate(divide='ignore', invalid='ignore'):
        t_stat = r_safe * np.sqrt(dof / (1 - r_safe ** 2))
    p_matrix = 2 * t_dist.sf(np.abs(t_stat), dof)
    np.fill_diagonal(p_matrix, 0.0)
    np.fill_diagonal(r_matrix, 1.0)

    p_matrix[pair_n < 3] = np.nan
    r_matrix[pair_n < 3] = np.nan

    cols = df.columns
    return (
        pd.DataFrame(r_matrix, index=cols, columns=cols),
        pd.DataFrame(p_matrix, index=cols, columns=cols),
    )


def cramers_v(x: pd.Series, y: pd.Series) -> float:
    confusion_matrix = pd.crosstab(x, y)
    if confusion_matrix.shape[0] < 2 or confusion_matrix.shape[1] < 2:
        return np.nan
    chi2 = chi2_contingency(confusion_matrix)[0]
    n = confusion_matrix.sum().sum()
    if n == 0:
        return np.nan
    phi2 = chi2 / n
    r, k = confusion_matrix.shape
    phi2corr = max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    rcorr = r - ((r - 1) ** 2) / (n - 1)
    kcorr = k - ((k - 1) ** 2) / (n - 1)
    denom = min(kcorr - 1, rcorr - 1)
    if denom == 0:
        return np.nan
    return float(np.sqrt(phi2corr / denom))


def _transactions_to_categorical_df(transactions: list) -> pd.DataFrame:
    prefixes = set()
    for trans in transactions:
        for elem in trans:
            if ':' in elem:
                prefixes.add(elem.split(':')[0])

    rows = []
    for trans in transactions:
        row = {}
        for prefix in prefixes:
            value = next(
                (elem[len(prefix) + 1:] for elem in trans if elem.startswith(prefix + ':')),
                None
            )
            row[prefix] = value
        rows.append(row)

    df = pd.DataFrame(rows)
    to_drop = [col for col in df.columns if df[col].nunique() < 2 or df[col].nunique() > 20]
    return df.drop(columns=to_drop)


def _matrix_to_json(matrix: pd.DataFrame) -> dict:
    clean = matrix.round(4).replace({np.nan: None})
    return {row: clean.loc[row].to_dict() for row in clean.index}


def run_correlation_analysis(numeric_records: list, transactions: list,
                             threshold_strong: float = 0.7,
                             threshold_dup: float = 0.95,
                             top_n: int = 10) -> dict:
    result = {}

    corr_pearson, p_matrix = compute_correlations_with_pvalue(numeric_records, method='pearson')
    if corr_pearson is not None:
        cols = corr_pearson.columns
        strong_pearson = []
        duplicate_pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                val = corr_pearson.iloc[i, j]
                p_val = p_matrix.iloc[i, j] if p_matrix is not None else None
                if pd.isna(val):
                    continue
                if abs(val) >= threshold_strong:
                    strong_pearson.append({
                        'feature_a': cols[i],
                        'feature_b': cols[j],
                        'r': round(float(val), 4),
                        'p_value': round(float(p_val), 6) if p_val is not None and not pd.isna(p_val) else None,
                        'significant': bool(p_val < 0.05) if p_val is not None and not pd.isna(p_val) else None,
                    })
                if abs(val) >= threshold_dup:
                    duplicate_pairs.append({'feature_a': cols[i], 'feature_b': cols[j], 'r': round(float(val), 4)})
        result['pearson'] = {
            'strong_pairs': strong_pearson[:top_n],
            'duplicate_pairs': duplicate_pairs,
            'matrix': _matrix_to_json(corr_pearson),
        }

    corr_spearman, _ = compute_correlations_with_pvalue(numeric_records, method='spearman')
    if corr_spearman is not None:
        cols = corr_spearman.columns
        strong_spearman = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                val = corr_spearman.iloc[i, j]
                if pd.isna(val):
                    continue
                if abs(val) >= threshold_strong:
                    strong_spearman.append({
                        'feature_a': cols[i],
                        'feature_b': cols[j],
                        'r': round(float(val), 4),
                    })
        strong_spearman.sort(key=lambda x: abs(x['r']), reverse=True)
        result['spearman'] = {
            'strong_pairs': strong_spearman[:top_n],
            'matrix': _matrix_to_json(corr_spearman),
        }

    cat_df = _transactions_to_categorical_df(transactions)
    if not cat_df.empty:
        cols = cat_df.columns
        cramers_pairs = []
        cramers_matrix = pd.DataFrame(1.0, index=cols, columns=cols)
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                v = cramers_v(cat_df[cols[i]], cat_df[cols[j]])
                cramers_matrix.iloc[i, j] = v
                cramers_matrix.iloc[j, i] = v
                if not np.isnan(v) and v >= threshold_strong:
                    cramers_pairs.append({
                        'feature_a': cols[i],
                        'feature_b': cols[j],
                        'cramers_v': round(v, 4),
                    })
        cramers_pairs.sort(key=lambda x: x['cramers_v'], reverse=True)
        result['cramers'] = {
            'strong_pairs': cramers_pairs[:top_n],
            'matrix': _matrix_to_json(cramers_matrix),
        }

    return result
