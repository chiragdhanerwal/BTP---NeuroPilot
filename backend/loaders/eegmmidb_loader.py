"""
EEGMMIDB Dataset Loader
Loads EEG Motor Movement/Imagery Dataset CSV files with annotations.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import re
import logging

logger = logging.getLogger(__name__)


class EEGMMIDBLoader:
    """Loader for PhysioNet EEG Motor Movement/Imagery Dataset (CSV format)."""
    
    def __init__(self, signal_dir: str, annotation_dir: str, sfreq: int = 160):
        self.signal_dir = Path(signal_dir)
        self.annotation_dir = Path(annotation_dir)
        self.sfreq = sfreq
        self.n_channels = 64
        self._index = None
    
    def scan(self) -> Dict:
        """Scan dataset and build index."""
        subjects = set()
        files = []
        
        for f in sorted(self.signal_dir.glob("SUB_*_SIG_*.csv")):
            match = re.match(r"SUB_(\d+)_SIG_(\d+)\.csv", f.name)
            if match:
                sub_id = int(match.group(1))
                run_id = int(match.group(2))
                subjects.add(sub_id)
                
                # Find matching annotation
                ann_name = f"SUB_{sub_id:03d}_ANN_{run_id:02d}.csv"
                ann_path = self.annotation_dir / ann_name
                
                files.append({
                    "subject": sub_id,
                    "run": run_id,
                    "signal_path": str(f),
                    "annotation_path": str(ann_path) if ann_path.exists() else None,
                    "task_type": self._get_task_type(run_id),
                    "file_size_mb": round(f.stat().st_size / 1024 / 1024, 2),
                })
        
        self._index = {
            "dataset": "EEGMMIDB",
            "format": "CSV",
            "n_subjects": len(subjects),
            "n_files": len(files),
            "n_channels": self.n_channels,
            "sfreq": self.sfreq,
            "subjects": sorted(subjects),
            "files": files,
        }
        return self._index
    
    def _get_task_type(self, run_id: int) -> str:
        """Map run number to task type."""
        mapping = {
            1: "Motor Execution - Fists", 5: "Motor Execution - Fists", 9: "Motor Execution - Fists",
            2: "Motor Imagery - Fists", 6: "Motor Imagery - Fists", 10: "Motor Imagery - Fists",
            3: "Motor Execution - Bilateral", 7: "Motor Execution - Bilateral", 11: "Motor Execution - Bilateral",
            4: "Motor Imagery - Bilateral", 8: "Motor Imagery - Bilateral", 12: "Motor Imagery - Bilateral",
        }
        return mapping.get(run_id, "Unknown")
    
    def load_signal(self, subject: int, run: int) -> np.ndarray:
        """Load raw EEG signal for a specific subject and run.
        Returns: np.ndarray of shape (n_samples, n_channels)
        """
        filename = f"SUB_{subject:03d}_SIG_{run:02d}.csv"
        filepath = self.signal_dir / filename
        
        if not filepath.exists():
            raise FileNotFoundError(f"Signal file not found: {filepath}")
        
        data = np.loadtxt(filepath, delimiter=",")
        logger.info(f"Loaded signal: {filename} - shape {data.shape}")
        return data
    
    def load_annotation(self, subject: int, run: int) -> pd.DataFrame:
        """Load annotation file for a specific subject and run."""
        filename = f"SUB_{subject:03d}_ANN_{run:02d}.csv"
        filepath = self.annotation_dir / filename
        
        if not filepath.exists():
            raise FileNotFoundError(f"Annotation file not found: {filepath}")
        
        df = pd.read_csv(filepath)
        df.columns = [c.strip() for c in df.columns]
        logger.info(f"Loaded annotation: {filename} - {len(df)} trials")
        return df
    
    def load_epochs(self, subject: int, run: int) -> Tuple[np.ndarray, np.ndarray]:
        """Load signal and split into epochs based on annotations.
        Returns: (epochs, labels) where epochs is (n_trials, n_samples, n_channels)
        """
        signal = self.load_signal(subject, run)
        annotations = self.load_annotation(subject, run)
        
        epochs = []
        labels = []
        
        for _, row in annotations.iterrows():
            label = int(row.get("class lable", row.get("class label", 0)))
            onset = int(row.get("onset", 0)) - 1  # Convert to 0-indexed
            end = int(row.get("end index", 0))
            
            if onset >= 0 and end <= len(signal):
                epoch = signal[onset:end, :]
                epochs.append(epoch)
                labels.append(label)
        
        return np.array(epochs, dtype=object), np.array(labels)
    
    def load_motor_imagery_data(self, subjects: Optional[List[int]] = None, 
                                 task: str = "fists") -> Tuple[np.ndarray, np.ndarray]:
        """Load motor imagery epochs for specified subjects.
        
        Args:
            subjects: List of subject IDs. None = all subjects.
            task: 'fists' for left/right hand, 'bilateral' for fists/feet
        
        Returns:
            (all_epochs, all_labels) - concatenated across subjects
        """
        if self._index is None:
            self.scan()
        
        if subjects is None:
            subjects = self._index["subjects"][:5]  # Default to first 5
        
        # Determine which runs contain motor imagery
        if task == "fists":
            target_runs = [2, 6, 10]  # Motor Imagery - Fists
            # Remap labels: Rest=0, Left=1, Right=2
            label_map = {}
            for r in target_runs:
                if r == 2: label_map.update({4: 0, 5: 1, 6: 2})
                elif r == 6: label_map.update({4: 0, 5: 1, 6: 2})
                elif r == 10: label_map.update({4: 0, 5: 1, 6: 2})
        else:
            target_runs = [4, 8, 12]  # Motor Imagery - Bilateral
            label_map = {10: 0, 11: 1, 12: 2}
        
        all_epochs = []
        all_labels = []
        
        for sub in subjects:
            for run in target_runs:
                try:
                    epochs, labels = self.load_epochs(sub, run)
                    for ep, lb in zip(epochs, labels):
                        if lb in label_map:
                            all_epochs.append(ep)
                            all_labels.append(label_map[lb])
                except Exception as e:
                    logger.warning(f"Error loading Sub {sub} Run {run}: {e}")
                    continue
        
        # Pad/truncate epochs to same length
        if all_epochs:
            target_len = int(np.median([e.shape[0] for e in all_epochs]))
            padded = []
            for ep in all_epochs:
                if len(ep) >= target_len:
                    padded.append(ep[:target_len])
                else:
                    pad = np.zeros((target_len - len(ep), ep.shape[1]))
                    padded.append(np.vstack([ep, pad]))
            return np.array(padded), np.array(all_labels)
        
        return np.array([]), np.array([])
    
    def get_metadata(self) -> Dict:
        """Get dataset metadata."""
        if self._index is None:
            self.scan()
        return {
            "dataset_name": "EEG Motor Movement/Imagery Dataset (EEGMMIDB)",
            "source": "PhysioNet",
            "n_subjects": self._index["n_subjects"],
            "n_channels": self.n_channels,
            "sampling_frequency": self.sfreq,
            "format": "CSV",
            "task_types": [
                "Motor Execution - Fists (Left/Right)",
                "Motor Imagery - Fists (Left/Right)",
                "Motor Execution - Bilateral (Both Fists/Both Feet)",
                "Motor Imagery - Bilateral (Both Fists/Both Feet)",
            ],
            "runs_per_subject": 12,
            "total_files": self._index["n_files"],
        }
    
    def get_signal_preview(self, subject: int, run: int, 
                           n_samples: int = 1000, channels: Optional[List[int]] = None) -> Dict:
        """Get a preview of EEG signal data for visualization."""
        signal = self.load_signal(subject, run)
        
        if channels is None:
            channels = list(range(min(8, signal.shape[1])))  # First 8 channels
        
        preview_data = signal[:n_samples, channels]
        time_axis = np.arange(n_samples) / self.sfreq
        
        return {
            "time": time_axis.tolist(),
            "channels": channels,
            "data": {f"ch_{ch}": preview_data[:, i].tolist() 
                    for i, ch in enumerate(channels)},
            "sfreq": self.sfreq,
            "n_samples": n_samples,
            "duration_sec": n_samples / self.sfreq,
        }
