"""
Feature Extraction for EEG Motor Imagery Classification
CSP, WPD, and spectral features.
"""
import numpy as np
from scipy import signal
from typing import Tuple, Optional, Dict
import logging

logger = logging.getLogger(__name__)


class CSPExtractor:
    """Common Spatial Patterns feature extraction."""
    
    def __init__(self, n_components: int = 6):
        self.n_components = n_components
        self.filters_ = None
        self.is_fitted = False
    
    def fit(self, X, y):
        classes = np.unique(y)
        if len(classes) != 2:
            mask = np.isin(y, classes[:2])
            X, y = X[mask], y[mask]
            classes = classes[:2]
        cov_1 = self._avg_cov(X[y == classes[0]])
        cov_2 = self._avg_cov(X[y == classes[1]])
        cov_c = cov_1 + cov_2
        ev, U = np.linalg.eigh(cov_c)
        idx = np.argsort(ev)[::-1]
        D = np.diag(1.0 / np.sqrt(ev[idx] + 1e-10))
        W = D @ U[:, idx].T
        S1 = W @ cov_1 @ W.T
        ev2, U2 = np.linalg.eigh(S1)
        idx2 = np.argsort(ev2)[::-1]
        U2 = U2[:, idx2]
        n = self.n_components // 2
        sel = np.concatenate([np.arange(n), np.arange(-n, 0)])
        self.filters_ = (U2[:, sel].T @ W)
        self.is_fitted = True
        return self
    
    def transform(self, X):
        if not self.is_fitted:
            raise RuntimeError("CSP not fitted")
        feats = []
        for ep in X:
            Z = self.filters_ @ ep.T
            v = np.var(Z, axis=1)
            v = v / (np.sum(v) + 1e-10)
            feats.append(np.log(v + 1e-10))
        return np.array(feats)
    
    def fit_transform(self, X, y):
        self.fit(X, y)
        return self.transform(X)
    
    def _avg_cov(self, X):
        covs = []
        for ep in X:
            c = np.cov(ep.T)
            covs.append(c / (np.trace(c) + 1e-10))
        return np.mean(covs, axis=0)


class SpectralFeatureExtractor:
    """Extract band power features from EEG."""
    
    def __init__(self, sfreq=160.0):
        self.sfreq = sfreq
        self.bands = {"theta": (4,8), "alpha": (8,13), "beta": (13,30), "mu": (8,12)}
    
    def extract(self, X):
        if X.ndim == 2:
            X = X[np.newaxis, ...]
        feats = []
        for ep in X:
            ef = []
            f, psd = signal.welch(ep, fs=self.sfreq, nperseg=min(64, ep.shape[0]), axis=0)
            for _, (lo, hi) in self.bands.items():
                m = (f >= lo) & (f <= hi)
                ef.extend(np.mean(psd[m], axis=0).tolist())
            feats.append(ef)
        return np.array(feats)
