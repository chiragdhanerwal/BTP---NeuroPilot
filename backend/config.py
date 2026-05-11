"""
NeuroPilot Backend Configuration
"""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

# Dataset paths
EEGMMIDB_DIR = BASE_DIR / "eegmmidb"
ANNOTATIONS_DIR = BASE_DIR / "anotation after lables"
DATA_DIR = BASE_DIR / "data"
BCICIV_MAT_DIR = DATA_DIR / "BCICIV_1_mat"
BCICIV_ASC_DIR = DATA_DIR / "BCICIV_1_asc"
BCICIV_2B_DIR = DATA_DIR / "BCICIV_2b_gdf"

# Model storage
MODELS_DIR = BACKEND_DIR / "models"
DEPLOYED_MODELS_DIR = BACKEND_DIR / "deployed_models"
UPLOADS_DIR = BACKEND_DIR / "uploads"

# EEG Parameters
EEGMMIDB_SFREQ = 160  # Hz
EEGMMIDB_N_CHANNELS = 64
BCICIV_SFREQ = 100  # Hz (BCI Competition IV Dataset 1)

# EEGMMIDB Label Mapping
EEGMMIDB_LABEL_MAP = {
    # Runs 3,7,11 (files 01,05,09 in our 0-indexed): Motor Execution - Fists
    "motor_execution_fists": {
        "runs": [1, 5, 9],  # 1-indexed run numbers in our files
        "labels": {1: "Rest", 2: "Left Fist", 3: "Right Fist"},
        "task_type": "Motor Execution"
    },
    # Runs 4,8,12 (files 02,06,10): Motor Imagery - Fists
    "motor_imagery_fists": {
        "runs": [2, 6, 10],
        "labels": {4: "Rest", 5: "Left Fist", 6: "Right Fist"},
        "task_type": "Motor Imagery"
    },
    # Runs 5,9,13 (files 03,07,11): Motor Execution - Bilateral
    "motor_execution_bilateral": {
        "runs": [3, 7, 11],
        "labels": {7: "Rest", 8: "Both Fists", 9: "Both Feet"},
        "task_type": "Motor Execution"
    },
    # Runs 6,10,14 (files 04,08,12): Motor Imagery - Bilateral
    "motor_imagery_bilateral": {
        "runs": [4, 8, 12],
        "labels": {10: "Rest", 11: "Both Fists", 12: "Both Feet"},
        "task_type": "Motor Imagery"
    },
}

# Frequency bands
FREQ_BANDS = {
    "delta": (0.5, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta": (13, 30),
    "gamma": (30, 45),
    "mu": (8, 12),  # Motor-related
}

# Preprocessing defaults
DEFAULT_BANDPASS = (8, 30)  # Hz (mu + beta bands for motor imagery)
DEFAULT_NOTCH = 60  # Hz
DEFAULT_EPOCH_TMIN = 0  # seconds relative to event
DEFAULT_EPOCH_TMAX = 4  # seconds relative to event

# Training defaults
DEFAULT_TEST_SPLIT = 0.2
DEFAULT_N_CSP_COMPONENTS = 6
DEFAULT_CV_FOLDS = 5

# WebSocket
WS_HEARTBEAT_INTERVAL = 5  # seconds

# API
API_PREFIX = "/api/v1"
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"]
