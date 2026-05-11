"""
EEG Signal Preprocessing Pipeline
Bandpass filtering, notch filtering, normalization, and artifact removal.
"""
import numpy as np
from scipy import signal
from scipy.signal import butter, filtfilt, iirnotch
from typing import Tuple, Optional, Dict
import logging

logger = logging.getLogger(__name__)


class EEGPreprocessor:
    """Complete EEG preprocessing pipeline."""
    
    def __init__(self, sfreq: float = 160.0):
        self.sfreq = sfreq
    
    def bandpass_filter(self, data: np.ndarray, low: float = 8.0, high: float = 30.0, 
                        order: int = 5) -> np.ndarray:
        """Apply bandpass filter.
        Args:
            data: (n_samples, n_channels) or (n_epochs, n_samples, n_channels)
        """
        nyquist = self.sfreq / 2
        low_n = low / nyquist
        high_n = high / nyquist
        b, a = butter(order, [low_n, high_n], btype='band')
        
        if data.ndim == 2:
            return filtfilt(b, a, data, axis=0)
        elif data.ndim == 3:
            filtered = np.zeros_like(data)
            for i in range(data.shape[0]):
                filtered[i] = filtfilt(b, a, data[i], axis=0)
            return filtered
        return data
    
    def notch_filter(self, data: np.ndarray, freq: float = 60.0, 
                     quality: float = 30.0) -> np.ndarray:
        """Apply notch filter to remove powerline interference."""
        b, a = iirnotch(freq, quality, self.sfreq)
        
        if data.ndim == 2:
            return filtfilt(b, a, data, axis=0)
        elif data.ndim == 3:
            filtered = np.zeros_like(data)
            for i in range(data.shape[0]):
                filtered[i] = filtfilt(b, a, data[i], axis=0)
            return filtered
        return data
    
    def normalize(self, data: np.ndarray, method: str = "zscore") -> np.ndarray:
        """Normalize EEG data.
        Methods: 'zscore', 'minmax', 'robust'
        """
        if method == "zscore":
            if data.ndim == 2:
                mean = np.mean(data, axis=0, keepdims=True)
                std = np.std(data, axis=0, keepdims=True) + 1e-8
                return (data - mean) / std
            elif data.ndim == 3:
                normalized = np.zeros_like(data)
                for i in range(data.shape[0]):
                    mean = np.mean(data[i], axis=0, keepdims=True)
                    std = np.std(data[i], axis=0, keepdims=True) + 1e-8
                    normalized[i] = (data[i] - mean) / std
                return normalized
        
        elif method == "minmax":
            if data.ndim == 2:
                dmin = np.min(data, axis=0, keepdims=True)
                dmax = np.max(data, axis=0, keepdims=True)
                return (data - dmin) / (dmax - dmin + 1e-8)
            elif data.ndim == 3:
                normalized = np.zeros_like(data)
                for i in range(data.shape[0]):
                    dmin = np.min(data[i], axis=0, keepdims=True)
                    dmax = np.max(data[i], axis=0, keepdims=True)
                    normalized[i] = (data[i] - dmin) / (dmax - dmin + 1e-8)
                return normalized
        
        return data
    
    def compute_psd(self, data: np.ndarray, nperseg: int = 256) -> Tuple[np.ndarray, np.ndarray]:
        """Compute Power Spectral Density.
        Args:
            data: (n_samples, n_channels) single trial/segment
        Returns:
            (frequencies, psd) where psd is (n_freqs, n_channels)
        """
        if data.ndim == 1:
            data = data.reshape(-1, 1)
        
        freqs, psd = signal.welch(data, fs=self.sfreq, nperseg=min(nperseg, len(data)), axis=0)
        return freqs, psd
    
    def compute_band_power(self, data: np.ndarray, bands: Optional[Dict] = None) -> Dict:
        """Compute power in frequency bands.
        Args:
            data: (n_samples, n_channels)
        Returns:
            Dict with band names as keys and power arrays (n_channels,) as values
        """
        if bands is None:
            bands = {
                "delta": (0.5, 4), "theta": (4, 8), "alpha": (8, 13),
                "beta": (13, 30), "gamma": (30, 45), "mu": (8, 12),
            }
        
        freqs, psd = self.compute_psd(data)
        result = {}
        
        for band_name, (low, high) in bands.items():
            mask = (freqs >= low) & (freqs <= high)
            result[band_name] = np.mean(psd[mask], axis=0).tolist()
        
        return result
    
    def compute_spectrogram(self, data: np.ndarray, channel: int = 0,
                           nperseg: int = 64, noverlap: int = 48) -> Dict:
        """Compute spectrogram for a single channel.
        Returns dict with times, frequencies, and power values.
        """
        if data.ndim == 2:
            channel_data = data[:, channel]
        else:
            channel_data = data
        
        f, t, Sxx = signal.spectrogram(channel_data, fs=self.sfreq, 
                                        nperseg=nperseg, noverlap=noverlap)
        
        return {
            "frequencies": f.tolist(),
            "times": t.tolist(),
            "power": (10 * np.log10(Sxx + 1e-12)).tolist(),
        }
    
    def full_pipeline(self, data: np.ndarray, 
                      bandpass: Tuple[float, float] = (8, 30),
                      notch: float = 60.0,
                      normalize_method: str = "zscore") -> np.ndarray:
        """Run complete preprocessing pipeline."""
        logger.info(f"Preprocessing: input shape {data.shape}")
        
        # Step 1: Notch filter
        data = self.notch_filter(data, freq=notch)
        logger.info("Applied notch filter")
        
        # Step 2: Bandpass filter
        data = self.bandpass_filter(data, low=bandpass[0], high=bandpass[1])
        logger.info(f"Applied bandpass filter [{bandpass[0]}-{bandpass[1]}] Hz")
        
        # Step 3: Normalize
        data = self.normalize(data, method=normalize_method)
        logger.info(f"Applied {normalize_method} normalization")
        
        return data
