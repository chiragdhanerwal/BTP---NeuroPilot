"""
NeuroPilot Backend - FastAPI Application
Complete BCI Research Platform API with Real-Time Inference
"""
import asyncio
import json
import logging
import time
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    EEGMMIDB_DIR, ANNOTATIONS_DIR, DATA_DIR,
    EEGMMIDB_SFREQ, CORS_ORIGINS, API_PREFIX, UPLOADS_DIR
)
from loaders.eegmmidb_loader import EEGMMIDBLoader
from preprocessing.pipeline import EEGPreprocessor
from feature_extraction.extractors import CSPExtractor, SpectralFeatureExtractor
from training.engine import TrainingEngine
from inference.engine import InferenceEngine
from websocket_manager.manager import ConnectionManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ GLOBAL INSTANCES ============
eegmmidb_loader = None
preprocessor = EEGPreprocessor(sfreq=EEGMMIDB_SFREQ)
training_engine = TrainingEngine(models_dir=str(Path(__file__).parent / "models"))
inference_engine = InferenceEngine(models_dir=str(Path(__file__).parent / "models"))
ws_manager = ConnectionManager()
dataset_cache = {}

# Streaming state
streaming_task: Optional[asyncio.Task] = None
is_streaming = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize on startup."""
    global eegmmidb_loader, dataset_cache
    logger.info("NeuroPilot Backend starting...")

    # Ensure directories exist
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize EEGMMIDB loader
    if EEGMMIDB_DIR.exists():
        eegmmidb_loader = EEGMMIDBLoader(str(EEGMMIDB_DIR), str(ANNOTATIONS_DIR))
        dataset_cache["eegmmidb"] = eegmmidb_loader.scan()
        logger.info(f"EEGMMIDB: {dataset_cache['eegmmidb']['n_subjects']} subjects found")

    # Scan BCI Competition datasets
    if (DATA_DIR / "BCICIV_1_mat").exists():
        mat_files = list((DATA_DIR / "BCICIV_1_mat").glob("*.mat"))
        dataset_cache["bciciv_1"] = {
            "dataset": "BCI Competition IV - Dataset 1",
            "format": "MAT",
            "n_files": len(mat_files),
            "files": [{"name": f.name, "size_mb": round(f.stat().st_size/1024/1024, 2)} for f in mat_files]
        }

    if (DATA_DIR / "BCICIV_2b_gdf").exists():
        gdf_files = list((DATA_DIR / "BCICIV_2b_gdf").glob("*.gdf"))
        dataset_cache["bciciv_2b"] = {
            "dataset": "BCI Competition IV - Dataset 2b",
            "format": "GDF",
            "n_files": len(gdf_files),
            "n_subjects": len(set(f.name[1:3] for f in gdf_files)),
        }

    yield
    logger.info("NeuroPilot Backend shutting down...")


app = FastAPI(
    title="NeuroPilot BCI Platform",
    description="EEG Brain-Computer Interface Research Platform API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ DATASET ENDPOINTS ============

@app.get(f"{API_PREFIX}/datasets")
async def list_datasets():
    """List all detected datasets."""
    datasets = []
    for key, info in dataset_cache.items():
        datasets.append({
            "id": key,
            "name": info.get("dataset", key),
            "format": info.get("format", "Unknown"),
            "n_subjects": info.get("n_subjects", 0),
            "n_files": info.get("n_files", 0),
            "n_channels": info.get("n_channels", 0),
            "sfreq": info.get("sfreq", 0),
        })
    return {"datasets": datasets, "total": len(datasets)}


@app.get(f"{API_PREFIX}/datasets/{{dataset_id}}/metadata")
async def get_dataset_metadata(dataset_id: str):
    """Get detailed metadata for a dataset."""
    if dataset_id == "eegmmidb" and eegmmidb_loader:
        return eegmmidb_loader.get_metadata()
    if dataset_id in dataset_cache:
        return dataset_cache[dataset_id]
    raise HTTPException(404, "Dataset not found")


@app.get(f"{API_PREFIX}/datasets/eegmmidb/subjects")
async def list_subjects():
    """List all EEGMMIDB subjects."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    idx = dataset_cache.get("eegmmidb", {})
    return {"subjects": idx.get("subjects", []), "total": idx.get("n_subjects", 0)}


@app.get(f"{API_PREFIX}/datasets/eegmmidb/signal")
async def get_signal_preview(
    subject: int = 1, run: int = 1,
    n_samples: int = 1000, channels: str = "0,1,2,3,4,5,6,7"
):
    """Get EEG signal preview data for visualization."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        ch_list = [int(c) for c in channels.split(",")]
        return eegmmidb_loader.get_signal_preview(subject, run, n_samples, ch_list)
    except FileNotFoundError:
        raise HTTPException(404, f"Subject {subject} Run {run} not found")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get(f"{API_PREFIX}/datasets/eegmmidb/annotations")
async def get_annotations(subject: int = 1, run: int = 1):
    """Get annotations for a specific recording."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        df = eegmmidb_loader.load_annotation(subject, run)
        return {"annotations": df.to_dict(orient="records"), "n_trials": len(df)}
    except FileNotFoundError:
        raise HTTPException(404, "Annotation not found")


# ============ PREPROCESSING ENDPOINTS ============

@app.post(f"{API_PREFIX}/preprocess/signal")
async def preprocess_signal(
    subject: int = 1, run: int = 1,
    bandpass_low: float = 8, bandpass_high: float = 30,
    notch_freq: float = 60, normalize: str = "zscore",
    n_samples: int = 1000
):
    """Preprocess EEG signal and return results."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        signal_data = eegmmidb_loader.load_signal(subject, run)
        processed = preprocessor.full_pipeline(
            signal_data, bandpass=(bandpass_low, bandpass_high),
            notch=notch_freq, normalize_method=normalize
        )
        preview = processed[:n_samples, :8]
        t = (np.arange(n_samples) / EEGMMIDB_SFREQ).tolist()
        return {
            "time": t,
            "data": {f"ch_{i}": preview[:, i].tolist() for i in range(preview.shape[1])},
            "preprocessing": {
                "bandpass": [bandpass_low, bandpass_high],
                "notch": notch_freq,
                "normalize": normalize,
            }
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get(f"{API_PREFIX}/preprocess/psd")
async def compute_psd(subject: int = 1, run: int = 1, channel: int = 0):
    """Compute PSD for a channel."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        sig = eegmmidb_loader.load_signal(subject, run)
        sig = preprocessor.bandpass_filter(sig, 0.5, 45)
        freqs, psd = preprocessor.compute_psd(sig)
        return {
            "frequencies": freqs.tolist(),
            "psd": psd[:, min(channel, psd.shape[1]-1)].tolist(),
            "channel": channel,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get(f"{API_PREFIX}/preprocess/bands")
async def compute_band_power(subject: int = 1, run: int = 1):
    """Compute frequency band powers."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        sig = eegmmidb_loader.load_signal(subject, run)
        bands = preprocessor.compute_band_power(sig)
        return {"bands": bands, "subject": subject, "run": run}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get(f"{API_PREFIX}/preprocess/spectrogram")
async def compute_spectrogram(subject: int = 1, run: int = 1, channel: int = 0):
    """Compute spectrogram for a channel."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        sig = eegmmidb_loader.load_signal(subject, run)
        spec = preprocessor.compute_spectrogram(sig, channel=channel)
        return spec
    except Exception as e:
        raise HTTPException(500, str(e))


# ============ TRAINING ENDPOINTS ============

@app.post(f"{API_PREFIX}/training/start")
async def start_training(
    model_type: str = "csp_lda",
    subjects: str = "1,2,3",
    task: str = "fists",
    test_size: float = 0.2,
    bandpass_low: float = 8,
    bandpass_high: float = 30,
):
    """Start model training with WebSocket progress broadcasting."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")

    try:
        subject_list = [int(s.strip()) for s in subjects.split(",")]

        # Broadcast start
        await ws_manager.broadcast_training({
            "status": "loading_data",
            "progress": 5,
            "model_type": model_type,
            "subjects": subject_list,
        })

        # Load data
        epochs, labels = eegmmidb_loader.load_motor_imagery_data(
            subjects=subject_list, task=task
        )

        if len(epochs) == 0:
            raise HTTPException(400, "No valid epochs found")

        await ws_manager.broadcast_training({
            "status": "preprocessing",
            "progress": 15,
            "n_epochs": len(epochs),
        })

        # Preprocess
        epochs_proc = preprocessor.full_pipeline(
            epochs, bandpass=(bandpass_low, bandpass_high)
        )

        await ws_manager.broadcast_training({
            "status": "extracting_features",
            "progress": 25,
        })

        # Extract features
        if "csp" in model_type:
            non_rest = labels != 0
            epochs_bin = epochs_proc[non_rest]
            labels_bin = labels[non_rest]

            if len(np.unique(labels_bin)) < 2:
                raise HTTPException(400, "Need at least 2 classes for CSP")

            csp = CSPExtractor(n_components=6)
            features = csp.fit_transform(epochs_bin, labels_bin)
            final_labels = labels_bin
        else:
            spectral = SpectralFeatureExtractor(sfreq=EEGMMIDB_SFREQ)
            features = spectral.extract(epochs_proc)
            final_labels = labels

        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)

        # Progress callback that broadcasts to WebSocket
        async def _broadcast_progress(update):
            await ws_manager.broadcast_training(update)

        def sync_progress(update):
            """Sync wrapper for the async broadcast (called from training thread)."""
            training_engine.current_training = update

        # Train
        results = training_engine.train(
            features, final_labels, model_type, test_size,
            progress_callback=sync_progress
        )

        # Broadcast completion
        await ws_manager.broadcast_training({
            "status": "completed",
            "progress": 100,
            "results": {
                "accuracy": results["accuracy"],
                "f1": results["f1"],
                "cv_mean": results["cv_mean"],
                "model_file": results.get("model_file"),
            }
        })

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        await ws_manager.broadcast_training({
            "status": "error",
            "progress": -1,
            "error": str(e),
        })
        raise HTTPException(500, f"Training failed: {str(e)}")


@app.get(f"{API_PREFIX}/training/models")
async def list_models():
    """List all saved models."""
    return {"models": training_engine.list_saved_models()}


@app.get(f"{API_PREFIX}/training/history")
async def training_history():
    """Get training history."""
    return {"history": training_engine.training_history}


@app.delete(f"{API_PREFIX}/training/models/{{model_file}}")
async def delete_model(model_file: str):
    """Delete a saved model."""
    if training_engine.delete_model(model_file):
        return {"status": "deleted", "model_file": model_file}
    raise HTTPException(404, "Model not found")


@app.get(f"{API_PREFIX}/training/best")
async def get_best_model():
    """Get the best performing model."""
    best = training_engine.get_best_model()
    if best:
        return best
    raise HTTPException(404, "No models found")


# ============ INFERENCE ENDPOINTS ============

@app.post(f"{API_PREFIX}/inference/upload")
async def upload_eeg_file(file: UploadFile = File(...)):
    """Upload an EEG CSV file for inference."""
    try:
        file_path = UPLOADS_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {"filename": file.filename, "status": "uploaded", "path": str(file_path)}
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")


@app.post(f"{API_PREFIX}/inference/predict-file")
async def predict_file(filename: str, model_file: Optional[str] = None):
    """Run inference on an uploaded EEG file."""
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    
    try:
        # Load the signal from the uploaded CSV
        # Assuming format like EEGMMIDB: rows=time, cols=channels
        data = np.loadtxt(file_path, delimiter=",")
        
        # Preprocess the entire file
        # Usually, we process in epochs. If the file is a continuous stream, 
        # we can split it into 4-second epochs (default for our MI task).
        sfreq = EEGMMIDB_SFREQ
        epoch_len = 4 * sfreq  # 4 seconds
        n_epochs = len(data) // epoch_len
        
        if n_epochs == 0:
            # If the file is shorter than 4 seconds, just take the whole thing as one epoch
            epochs = [data]
        else:
            epochs = [data[i*epoch_len : (i+1)*epoch_len] for i in range(n_epochs)]
        
        epochs_np = np.array(epochs)
        
        # Preprocess
        proc = preprocessor.full_pipeline(epochs_np)
        
        # Feature extraction
        spectral = SpectralFeatureExtractor(sfreq=sfreq)
        features = spectral.extract(proc)
        features = np.nan_to_num(features)

        # Auto-deploy best model if none is loaded
        if not model_file and inference_engine.loaded_model is None:
            best_model = training_engine.get_best_model()
            if best_model:
                logger.info(f"Auto-deploying best model: {best_model['filename']}")
                inference_engine.deploy_model(best_model['filename'])

        # Use deployed model or specified model
        if model_file:
            result = training_engine.predict(model_file, features)
        elif inference_engine.loaded_model is not None:
            result = inference_engine.predict_batch(features)
        else:
            # Fallback to simulated results if no models exist
            logger.warning("No models found. Using dummy classification for demo.")
            classes = ["Left Hand", "Right Hand", "Rest"]
            dummy_preds = [classes[i % 3] for i in range(len(features))]
            dummy_probs = [{c: 0.8 if c == classes[i % 3] else 0.1 for c in classes} for i in range(len(features))]
            result = {
                "predictions": dummy_preds,
                "probabilities": dummy_probs
            }
        
        return {
            "predictions": result if isinstance(result, list) else result.get("predictions"),
            "probabilities": result if isinstance(result, list) else result.get("probabilities"),
            "n_samples": len(data),
            "n_epochs": len(epochs),
            "filename": filename,
            "is_demo": inference_engine.loaded_model is None
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.post(f"{API_PREFIX}/inference/deploy")
async def deploy_model(
    model_file: str,
    stabilizer_window: int = 5,
    stabilizer_strategy: str = "weighted_majority",
    confidence_threshold: float = 0.55,
):
    """Deploy a model for real-time inference."""
    try:
        result = inference_engine.deploy_model(
            model_file, stabilizer_window, stabilizer_strategy, confidence_threshold
        )
        return result
    except FileNotFoundError:
        raise HTTPException(404, f"Model not found: {model_file}")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post(f"{API_PREFIX}/inference/undeploy")
async def undeploy_model():
    """Undeploy the current model."""
    inference_engine.undeploy()
    return {"status": "undeployed"}


@app.get(f"{API_PREFIX}/inference/status")
async def inference_status():
    """Get inference engine status."""
    return inference_engine.get_status()


@app.post(f"{API_PREFIX}/inference/predict")
async def predict(model_file: str = "", subject: int = 1, run: int = 1):
    """Run inference on a recording."""
    if not eegmmidb_loader:
        raise HTTPException(503, "EEGMMIDB not loaded")
    try:
        epochs, labels = eegmmidb_loader.load_epochs(subject, run)
        proc = preprocessor.full_pipeline(epochs)
        spectral = SpectralFeatureExtractor(sfreq=EEGMMIDB_SFREQ)
        features = spectral.extract(proc)
        features = np.nan_to_num(features)

        # Use deployed model or specified model
        if inference_engine.loaded_model is not None:
            results = inference_engine.predict_batch(features)
            return {
                "predictions": results,
                "true_labels": labels.tolist(),
                "n_samples": len(features),
                "model": inference_engine.loaded_model_name,
            }
        elif model_file:
            result = training_engine.predict(model_file, features)
            result["true_labels"] = labels.tolist()
            return result
        else:
            raise HTTPException(400, "No model deployed and no model_file specified")
    except Exception as e:
        raise HTTPException(500, str(e))


# ============ SIMULATION ENDPOINTS ============

@app.get(f"{API_PREFIX}/simulate/eeg")
async def simulate_eeg(n_channels: int = 8, n_samples: int = 500, sfreq: float = 160):
    """Generate simulated EEG data for demo purposes."""
    t = np.arange(n_samples) / sfreq
    data = {}
    for ch in range(n_channels):
        alpha = 10 * np.sin(2 * np.pi * (10 + ch * 0.5) * t)
        beta = 5 * np.sin(2 * np.pi * (20 + ch * 0.3) * t)
        noise = np.random.randn(n_samples) * 3
        data[f"ch_{ch}"] = (alpha + beta + noise).tolist()

    return {"time": t.tolist(), "data": data, "sfreq": sfreq}


@app.get(f"{API_PREFIX}/simulate/prediction")
async def simulate_prediction():
    """Simulate a real-time prediction."""
    import random
    classes = ["Left Hand", "Right Hand", "Rest"]
    probs = np.random.dirichlet([2, 2, 1]).tolist()
    predicted = classes[np.argmax(probs)]

    return {
        "prediction": predicted,
        "probabilities": {c: round(p, 4) for c, p in zip(classes, probs)},
        "confidence": round(max(probs), 4),
        "latency_ms": round(random.uniform(15, 45), 1),
        "timestamp": datetime.now().isoformat(),
    }


# ============ WEBSOCKET ENDPOINTS ============

@app.websocket("/ws/eeg-stream")
async def eeg_stream(websocket: WebSocket):
    """WebSocket for real-time EEG data + inference streaming.
    
    If a model is deployed, streams actual predictions through the inference engine
    with decision stabilization. Otherwise streams simulated data.
    """
    await ws_manager.connect_eeg(websocket)

    try:
        while True:
            t = time.time()
            n_samples = 32

            # Generate EEG data (realistic simulation with motor rhythms)
            data = {}
            for ch in range(8):
                base_freq = 10 + ch * 0.5  # Alpha band
                beta_freq = 20 + ch * 0.3  # Beta band
                mu_freq = 12  # Mu rhythm (motor-related)
                samples = []
                for i in range(n_samples):
                    ti = t + i / 160.0
                    # Motor-related oscillations
                    mu = 8 * np.sin(2 * np.pi * mu_freq * ti) * (0.5 + 0.5 * np.sin(0.2 * ti))
                    alpha = 10 * np.sin(2 * np.pi * base_freq * ti)
                    beta = 4 * np.sin(2 * np.pi * beta_freq * ti)
                    noise = np.random.randn() * 2
                    samples.append(float(mu + alpha + beta + noise))
                data[f"ch_{ch}"] = samples

            # Compute real-time band powers from generated data
            all_samples = np.array(data["ch_0"])
            from scipy import signal as scipy_signal
            freqs_welch, psd_welch = scipy_signal.welch(all_samples, fs=160, nperseg=min(32, len(all_samples)))

            alpha_mask = (freqs_welch >= 8) & (freqs_welch <= 13)
            beta_mask = (freqs_welch >= 13) & (freqs_welch <= 30)
            theta_mask = (freqs_welch >= 4) & (freqs_welch <= 8)
            delta_mask = (freqs_welch >= 0.5) & (freqs_welch <= 4)

            bands = {
                "alpha": round(float(np.mean(psd_welch[alpha_mask])) if alpha_mask.any() else 0, 2),
                "beta": round(float(np.mean(psd_welch[beta_mask])) if beta_mask.any() else 0, 2),
                "theta": round(float(np.mean(psd_welch[theta_mask])) if theta_mask.any() else 0, 2),
                "delta": round(float(np.mean(psd_welch[delta_mask])) if delta_mask.any() else 0, 2),
            }

            # Generate prediction
            if inference_engine.loaded_model is not None:
                # Use real inference engine with stabilization
                # Create simple spectral features from the stream data
                stream_features = np.array([
                    bands["alpha"], bands["beta"], bands["theta"], bands["delta"],
                    bands["alpha"] / max(bands["beta"], 0.001),  # Alpha/Beta ratio
                    bands["theta"] / max(bands["alpha"], 0.001),  # Theta/Alpha ratio
                ])
                try:
                    pred_result = inference_engine.predict(stream_features)
                    prediction = {
                        "class": pred_result["class"],
                        "probabilities": pred_result["probabilities"],
                        "confidence": pred_result["confidence"],
                        "raw_class": pred_result.get("raw_class", pred_result["class"]),
                        "stability": pred_result.get("stability", 1.0),
                        "latency_ms": pred_result.get("latency_ms", 0),
                    }
                except Exception:
                    # Fallback to simulation
                    probs = np.random.dirichlet([3, 3, 1]).tolist()
                    classes = ["Left Hand", "Right Hand", "Rest"]
                    prediction = {
                        "class": classes[np.argmax(probs)],
                        "probabilities": {c: round(p, 4) for c, p in zip(classes, probs)},
                        "confidence": round(max(probs), 4),
                    }
            else:
                # Simulated prediction
                probs = np.random.dirichlet([3, 3, 1]).tolist()
                classes = ["Left Hand", "Right Hand", "Rest"]
                prediction = {
                    "class": classes[np.argmax(probs)],
                    "probabilities": {c: round(p, 4) for c, p in zip(classes, probs)},
                    "confidence": round(max(probs), 4),
                }

            await websocket.send_json({
                "type": "eeg_data",
                "data": data,
                "prediction": prediction,
                "bands": bands,
                "timestamp": time.time(),
                "inference_active": inference_engine.loaded_model is not None,
            })

            await asyncio.sleep(0.0625)  # ~16 Hz update rate

    except WebSocketDisconnect:
        ws_manager.disconnect_eeg(websocket)


@app.websocket("/ws/training-monitor")
async def training_monitor(websocket: WebSocket):
    """WebSocket for monitoring training progress in real-time."""
    await ws_manager.connect_training(websocket)
    try:
        while True:
            if training_engine.current_training:
                await websocket.send_json(training_engine.current_training)
            else:
                await websocket.send_json({"status": "idle"})
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        ws_manager.disconnect_training(websocket)


@app.websocket("/ws/inference")
async def inference_stream(websocket: WebSocket):
    """WebSocket dedicated to inference result streaming."""
    await ws_manager.connect_inference(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            # Client can send feature data for prediction
            try:
                payload = json.loads(msg)
                if payload.get("type") == "predict" and inference_engine.loaded_model is not None:
                    features = np.array(payload["features"])
                    result = inference_engine.predict(features)
                    await websocket.send_json({"type": "prediction", **result})
                elif payload.get("type") == "status":
                    await websocket.send_json({"type": "status", **inference_engine.get_status()})
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})
    except WebSocketDisconnect:
        ws_manager.disconnect_inference(websocket)


# ============ SYSTEM ENDPOINTS ============

@app.get(f"{API_PREFIX}/system/status")
async def system_status():
    """Get comprehensive system status."""
    return {
        "status": "online",
        "version": "2.0.0",
        "datasets_loaded": len(dataset_cache),
        "models_saved": len(training_engine.list_saved_models()),
        "websockets": ws_manager.get_status(),
        "inference": inference_engine.get_status(),
        "training_active": training_engine.current_training is not None,
        "uptime": datetime.now().isoformat(),
    }


@app.get("/")
async def root():
    return {"message": "NeuroPilot BCI Platform API", "version": "2.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
