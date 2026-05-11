"""
Real-Time Inference Engine with Decision Stabilization
Handles model loading, prediction, sliding-window smoothing,
majority voting, and confidence thresholding.
"""
import numpy as np
import joblib
import json
import time
import logging
from pathlib import Path
from typing import Dict, Optional, List, Tuple
from collections import deque
from datetime import datetime

logger = logging.getLogger(__name__)


class DecisionStabilizer:
    """Stabilizes real-time BCI predictions using multiple strategies."""

    def __init__(
        self,
        window_size: int = 5,
        confidence_threshold: float = 0.55,
        strategy: str = "weighted_majority",  # "majority", "weighted_majority", "exponential"
        decay_factor: float = 0.8,
    ):
        self.window_size = window_size
        self.confidence_threshold = confidence_threshold
        self.strategy = strategy
        self.decay_factor = decay_factor
        self.prediction_buffer: deque = deque(maxlen=window_size)
        self.confidence_buffer: deque = deque(maxlen=window_size)
        self.probability_buffer: deque = deque(maxlen=window_size)
        self.stable_prediction = "Rest"
        self.stable_confidence = 0.0
        self.switch_count = 0
        self.total_predictions = 0

    def add_prediction(
        self, predicted_class: str, confidence: float, probabilities: Dict[str, float]
    ) -> Dict:
        """Add a new prediction and return stabilized output."""
        self.prediction_buffer.append(predicted_class)
        self.confidence_buffer.append(confidence)
        self.probability_buffer.append(probabilities)
        self.total_predictions += 1

        if self.strategy == "majority":
            result = self._majority_vote()
        elif self.strategy == "weighted_majority":
            result = self._weighted_majority()
        elif self.strategy == "exponential":
            result = self._exponential_smoothing()
        else:
            result = self._weighted_majority()

        # Apply confidence threshold
        if result["confidence"] < self.confidence_threshold:
            prev = self.stable_prediction
            self.stable_prediction = "Rest"
            self.stable_confidence = result["confidence"]
        else:
            prev = self.stable_prediction
            self.stable_prediction = result["class"]
            self.stable_confidence = result["confidence"]

        if prev != self.stable_prediction:
            self.switch_count += 1

        return {
            "class": self.stable_prediction,
            "confidence": round(self.stable_confidence, 4),
            "raw_class": predicted_class,
            "raw_confidence": round(confidence, 4),
            "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
            "stability": round(1 - (self.switch_count / max(self.total_predictions, 1)), 4),
            "buffer_size": len(self.prediction_buffer),
            "strategy": self.strategy,
        }

    def _majority_vote(self) -> Dict:
        """Simple majority voting."""
        if not self.prediction_buffer:
            return {"class": "Rest", "confidence": 0.0}
        
        from collections import Counter
        counts = Counter(self.prediction_buffer)
        winner = counts.most_common(1)[0]
        return {
            "class": winner[0],
            "confidence": winner[1] / len(self.prediction_buffer),
        }

    def _weighted_majority(self) -> Dict:
        """Majority vote weighted by confidence."""
        if not self.prediction_buffer:
            return {"class": "Rest", "confidence": 0.0}

        class_scores: Dict[str, float] = {}
        for pred, conf in zip(self.prediction_buffer, self.confidence_buffer):
            class_scores[pred] = class_scores.get(pred, 0) + conf

        winner = max(class_scores, key=class_scores.get)  # type: ignore
        total = sum(class_scores.values())
        return {
            "class": winner,
            "confidence": class_scores[winner] / total if total > 0 else 0,
        }

    def _exponential_smoothing(self) -> Dict:
        """Exponential decay smoothing over probability distributions."""
        if not self.probability_buffer:
            return {"class": "Rest", "confidence": 0.0}

        all_classes = set()
        for p in self.probability_buffer:
            all_classes.update(p.keys())

        smoothed: Dict[str, float] = {c: 0.0 for c in all_classes}
        weight_sum = 0.0

        for i, probs in enumerate(self.probability_buffer):
            weight = self.decay_factor ** (len(self.probability_buffer) - 1 - i)
            weight_sum += weight
            for c in all_classes:
                smoothed[c] += probs.get(c, 0) * weight

        for c in smoothed:
            smoothed[c] /= weight_sum if weight_sum > 0 else 1

        winner = max(smoothed, key=smoothed.get)  # type: ignore
        return {"class": winner, "confidence": smoothed[winner]}

    def reset(self):
        self.prediction_buffer.clear()
        self.confidence_buffer.clear()
        self.probability_buffer.clear()
        self.stable_prediction = "Rest"
        self.stable_confidence = 0.0
        self.switch_count = 0
        self.total_predictions = 0


class InferenceEngine:
    """
    Manages model loading and real-time inference for BCI predictions.
    Supports both traditional ML (sklearn) and deep learning models.
    """

    CLASS_LABELS = {0: "Rest", 1: "Left Hand", 2: "Right Hand", 3: "Both Fists", 4: "Feet"}

    def __init__(self, models_dir: str = "models"):
        self.models_dir = Path(models_dir)
        self.loaded_model = None
        self.loaded_model_name: Optional[str] = None
        self.loaded_model_meta: Optional[Dict] = None
        self.stabilizer = DecisionStabilizer()
        self.inference_count = 0
        self.total_latency_ms = 0.0

    def deploy_model(
        self,
        model_file: str,
        stabilizer_window: int = 5,
        stabilizer_strategy: str = "weighted_majority",
        confidence_threshold: float = 0.55,
    ) -> Dict:
        """Load and deploy a model for real-time inference."""
        model_path = self.models_dir / model_file
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        self.loaded_model = joblib.load(model_path)
        self.loaded_model_name = model_file

        # Load metadata
        meta_name = model_file.replace(".pkl", "_meta.json")
        meta_path = self.models_dir / meta_name
        if meta_path.exists():
            with open(meta_path) as f:
                self.loaded_model_meta = json.load(f)

        # Reset stabilizer
        self.stabilizer = DecisionStabilizer(
            window_size=stabilizer_window,
            confidence_threshold=confidence_threshold,
            strategy=stabilizer_strategy,
        )
        self.inference_count = 0
        self.total_latency_ms = 0.0

        logger.info(f"Model deployed: {model_file}")
        return {
            "status": "deployed",
            "model_file": model_file,
            "model_meta": self.loaded_model_meta,
            "stabilizer": {
                "window_size": stabilizer_window,
                "strategy": stabilizer_strategy,
                "confidence_threshold": confidence_threshold,
            },
        }

    def predict(self, features: np.ndarray) -> Dict:
        """Run single-sample inference with stabilization."""
        if self.loaded_model is None:
            raise RuntimeError("No model deployed. Call deploy_model() first.")

        start = time.perf_counter()

        # Ensure 2D input
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Replace NaN/Inf
        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)

        # Predict
        pred_class = int(self.loaded_model.predict(features)[0])
        class_label = self.CLASS_LABELS.get(pred_class, f"Class_{pred_class}")

        # Get probabilities
        if hasattr(self.loaded_model, "predict_proba"):
            proba = self.loaded_model.predict_proba(features)[0]
            classes = self.loaded_model.classes_
            probabilities = {
                self.CLASS_LABELS.get(int(c), f"Class_{c}"): float(p)
                for c, p in zip(classes, proba)
            }
            confidence = float(np.max(proba))
        else:
            probabilities = {class_label: 1.0}
            confidence = 1.0

        latency_ms = (time.perf_counter() - start) * 1000
        self.inference_count += 1
        self.total_latency_ms += latency_ms

        # Stabilize
        stabilized = self.stabilizer.add_prediction(class_label, confidence, probabilities)

        return {
            **stabilized,
            "latency_ms": round(latency_ms, 2),
            "avg_latency_ms": round(self.total_latency_ms / self.inference_count, 2),
            "inference_count": self.inference_count,
            "model": self.loaded_model_name,
            "timestamp": datetime.now().isoformat(),
        }

    def predict_batch(self, features: np.ndarray) -> List[Dict]:
        """Run batch inference (no stabilization)."""
        if self.loaded_model is None:
            raise RuntimeError("No model deployed.")

        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
        preds = self.loaded_model.predict(features)

        results = []
        if hasattr(self.loaded_model, "predict_proba"):
            probas = self.loaded_model.predict_proba(features)
            classes = self.loaded_model.classes_
            for pred, proba in zip(preds, probas):
                label = self.CLASS_LABELS.get(int(pred), f"Class_{pred}")
                prob_dict = {
                    self.CLASS_LABELS.get(int(c), f"Class_{c}"): float(p)
                    for c, p in zip(classes, proba)
                }
                results.append({
                    "class": label,
                    "confidence": float(np.max(proba)),
                    "probabilities": prob_dict,
                })
        else:
            for pred in preds:
                label = self.CLASS_LABELS.get(int(pred), f"Class_{pred}")
                results.append({"class": label, "confidence": 1.0, "probabilities": {label: 1.0}})

        return results

    def get_status(self) -> Dict:
        """Get inference engine status."""
        return {
            "deployed": self.loaded_model is not None,
            "model_file": self.loaded_model_name,
            "inference_count": self.inference_count,
            "avg_latency_ms": round(self.total_latency_ms / max(self.inference_count, 1), 2),
            "stabilizer": {
                "strategy": self.stabilizer.strategy,
                "window_size": self.stabilizer.window_size,
                "confidence_threshold": self.stabilizer.confidence_threshold,
                "stability_score": self.stabilizer.stable_confidence,
            },
        }

    def undeploy(self):
        """Undeploy the current model."""
        self.loaded_model = None
        self.loaded_model_name = None
        self.loaded_model_meta = None
        self.stabilizer.reset()
        self.inference_count = 0
        self.total_latency_ms = 0.0
        logger.info("Model undeployed")
