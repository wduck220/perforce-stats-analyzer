import pandas as pd
import numpy as np


class FeatureCleaner:

    def __init__(self, threshold=0.95):
        self.threshold = threshold
        self.dropped_features = []
        self.retained_features = []

    def fit(self, df: pd.DataFrame) -> 'FeatureCleaner':
        corr_matrix = df.corr().abs()
        upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
        self.dropped_features = [col for col in upper.columns if any(upper[col] >= self.threshold)]
        self.retained_features = [col for col in df.columns if col not in self.dropped_features]
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.retained_features:
            raise ValueError("Сначала вызовите fit().")
        return df[self.retained_features]

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.fit(df).transform(df)

    def get_dropped_info(self) -> dict:
        return {
            'dropped': self.dropped_features,
            'retained': self.retained_features,
            'dropped_count': len(self.dropped_features),
            'retained_count': len(self.retained_features),
        }
