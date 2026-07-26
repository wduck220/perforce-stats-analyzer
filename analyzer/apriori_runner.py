import pandas as pd
from mlxtend.preprocessing import TransactionEncoder
from mlxtend.frequent_patterns import apriori, association_rules


def run_apriori(transactions: list, min_support: float = 0.1,
                min_confidence: float = 0.5, top_n: int = 50) -> dict:
    if not transactions:
        return {}

    te = TransactionEncoder()
    try:
        te_ary = te.fit(transactions).transform(transactions)
    except Exception as e:
        print(f"[Apriori] Ошибка TransactionEncoder: {e}")
        return {}

    df = pd.DataFrame(te_ary, columns=te.columns_)
    frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)

    if frequent_itemsets.empty:
        return {}

    rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)
    if rules.empty:
        return {}

    rules['key'] = [frozenset(a | b) for a, b in zip(rules['antecedents'], rules['consequents'])]
    idx_max_lift = rules.groupby('key')['lift'].idxmax()
    rules_unique = rules.loc[idx_max_lift].drop(columns=['key'])
    top_rules = rules_unique.sort_values('lift', ascending=False).head(top_n)

    rules_list = [
        {
            'antecedents': list(row['antecedents']),
            'consequents': list(row['consequents']),
            'support': round(float(row['support']), 4),
            'confidence': round(float(row['confidence']), 4),
            'lift': round(float(row['lift']), 4),
        }
        for _, row in top_rules.iterrows()
    ]

    unique_elems = set()
    for t in transactions:
        unique_elems.update(t)

    return {
        'total_transactions': len(transactions),
        'unique_elements': len(unique_elems),
        'rules_count': len(rules_list),
        'rules': rules_list,
    }
