"""
Model Training Engine for EEG Motor Imagery Classification
Supports: CSP+LDA, CSP+SVM, Spectral+LDA, Spectral+SVM, and CNN on spectrograms.
Features async progress broadcasting via WebSocket.
"""
import numpy as np
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import cross_val_score, train_test_split, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib
import json
import time
from pathlib import Path
from typing import Dict, Optional, Callable, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class TrainingEngine:
    """Manages model training for EEG classification with progress tracking."""

    MODELS = {
        "csp_lda": "CSP + LDA",
        "csp_svm": "CSP + SVM",
        "spectral_svm": "Spectral + SVM",
        "spectral_lda": "Spectral + LDA",
        "spectral_rf": "Spectral + Random Forest",
        "spectral_gb": "Spectral + Gradient Boosting",
    }

    def __init__(self, models_dir: str = "models"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.current_training = None
        self.training_history = []
        self._progress_callback: Optional[Callable] = None

    def _update_progress(self, status: str, progress: int, metrics: Optional[Dict] = None):
        """Update training progress and notify via callback."""
        update = {
            "status": status,
            "progress": progress,
            "timestamp": datetime.now().isoformat(),
        }
        if metrics:
            update["metrics"] = metrics
        if self.current_training:
            self.current_training.update(update)
        if self._progress_callback:
            try:
                self._progress_callback(update)
            except Exception:
                pass

    def _build_classifier(self, model_type: str) -> Pipeline:
        """Build a scikit-learn pipeline for the given model type."""
        if model_type in ("csp_lda", "spectral_lda"):
            return Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LinearDiscriminantAnalysis())
            ])
        elif model_type in ("csp_svm", "spectral_svm"):
            return Pipeline([
                ("scaler", StandardScaler()),
                ("clf", SVC(kernel="rbf", probability=True, C=1.0, gamma="scale"))
            ])
        elif model_type == "spectral_rf":
            return Pipeline([
                ("scaler", StandardScaler()),
                ("clf", RandomForestClassifier(
                    n_estimators=100, max_depth=10, random_state=42, n_jobs=-1
                ))
            ])
        elif model_type == "spectral_gb":
            return Pipeline([
                ("scaler", StandardScaler()),
                ("clf", GradientBoostingClassifier(
                    n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
                ))
            ])
        else:
            return Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LinearDiscriminantAnalysis())
            ])

    def train(
        self,
        X_features: np.ndarray,
        y: np.ndarray,
        model_type: str = "csp_lda",
        test_size: float = 0.2,
        progress_callback: Optional[Callable] = None,
        cv_folds: int = 5,
    ) -> Dict:
        """Train a model with detailed progress tracking."""

        start_time = time.time()
        self._progress_callback = progress_callback
        self.current_training = {
            "model_type": model_type,
            "model_name": self.MODELS.get(model_type, model_type),
            "status": "initializing",
            "started_at": datetime.now().isoformat(),
            "progress": 0,
            "n_samples": len(X_features),
            "n_features": X_features.shape[1] if X_features.ndim > 1 else 1,
            "n_classes": len(np.unique(y)),
        }

        try:
            # Phase 1: Data validation
            self._update_progress("validating_data", 5)
            X_features = np.nan_to_num(X_features, nan=0.0, posinf=0.0, neginf=0.0)

            unique_classes = np.unique(y)
            if len(unique_classes) < 2:
                raise ValueError(f"Need >= 2 classes, got {len(unique_classes)}")

            # Phase 2: Split data
            self._update_progress("splitting_data", 10)
            X_train, X_test, y_train, y_test = train_test_split(
                X_features, y, test_size=test_size, random_state=42, stratify=y
            )

            # Phase 3: Build model
            self._update_progress("building_model", 15)
            clf = self._build_classifier(model_type)

            # Phase 4: Training
            self._update_progress("training", 20)
            clf.fit(X_train, y_train)
            self._update_progress("training_complete", 50)

            # Phase 5: Evaluation
            self._update_progress("evaluating", 55)
            y_pred = clf.predict(X_test)
            y_pred_train = clf.predict(X_train)

            acc = float(accuracy_score(y_test, y_pred))
            train_acc = float(accuracy_score(y_train, y_pred_train))

            self._update_progress("evaluating", 60, {"accuracy": acc, "train_accuracy": train_acc})

            # Phase 6: Cross-validation
            self._update_progress("cross_validating", 65)
            n_folds = min(cv_folds, min(np.bincount(y.astype(int))))
            n_folds = max(2, n_folds)
            cv_scores = cross_val_score(
                clf, X_features, y, cv=StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42),
                scoring="accuracy"
            )

            self._update_progress("cross_validation_complete", 80, {
                "cv_mean": float(cv_scores.mean()),
                "cv_std": float(cv_scores.std()),
                "cv_scores": cv_scores.tolist(),
            })

            # Phase 7: Compute full metrics
            self._update_progress("computing_metrics", 85)
            cm = confusion_matrix(y_test, y_pred)
            report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

            results = {
                "model_type": model_type,
                "model_name": self.MODELS.get(model_type, model_type),
                "accuracy": acc,
                "train_accuracy": train_acc,
                "precision": float(precision_score(y_test, y_pred, average="weighted", zero_division=0)),
                "recall": float(recall_score(y_test, y_pred, average="weighted", zero_division=0)),
                "f1": float(f1_score(y_test, y_pred, average="weighted", zero_division=0)),
                "cv_mean": float(cv_scores.mean()),
                "cv_std": float(cv_scores.std()),
                "cv_scores": cv_scores.tolist(),
                "confusion_matrix": cm.tolist(),
                "classification_report": report,
                "n_train": len(X_train),
                "n_test": len(X_test),
                "n_features": X_features.shape[1] if X_features.ndim > 1 else 1,
                "n_classes": len(unique_classes),
                "class_labels": unique_classes.tolist(),
                "class_distribution": {str(c): int((y == c).sum()) for c in unique_classes},
                "overfitting_gap": round(train_acc - acc, 4),
                "training_time": round(time.time() - start_time, 2),
                "timestamp": datetime.now().isoformat(),
            }

            # Phase 8: Save model
            self._update_progress("saving_model", 90)
            model_filename = f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            model_path = self.models_dir / f"{model_filename}.pkl"
            meta_path = self.models_dir / f"{model_filename}_meta.json"

            joblib.dump(clf, model_path)
            with open(meta_path, "w") as f:
                json.dump(results, f, indent=2, default=str)

            results["model_path"] = str(model_path)
            results["model_file"] = f"{model_filename}.pkl"

            # Complete
            self._update_progress("completed", 100, {
                "accuracy": acc,
                "f1": results["f1"],
                "cv_mean": results["cv_mean"],
            })

            self.training_history.append(results)
            logger.info(
                f"Training complete: {model_type} | "
                f"Acc={acc:.4f} | F1={results['f1']:.4f} | "
                f"CV={results['cv_mean']:.4f}±{results['cv_std']:.4f}"
            )
            return results

        except Exception as e:
            self._update_progress("error", -1, {"error": str(e)})
            logger.error(f"Training failed: {e}", exc_info=True)
            raise
        finally:
            self.current_training = None
            self._progress_callback = None

    def train_all_models(
        self,
        X_features: np.ndarray,
        y: np.ndarray,
        model_types: Optional[List[str]] = None,
        test_size: float = 0.2,
        progress_callback: Optional[Callable] = None,
    ) -> List[Dict]:
        """Train multiple models and return comparison results."""
        if model_types is None:
            model_types = ["csp_lda", "csp_svm", "spectral_lda", "spectral_svm"]

        all_results = []
        for i, mt in enumerate(model_types):
            logger.info(f"Training model {i+1}/{len(model_types)}: {mt}")
            try:
                result = self.train(X_features, y, mt, test_size, progress_callback)
                all_results.append(result)
            except Exception as e:
                logger.error(f"Failed to train {mt}: {e}")
                all_results.append({"model_type": mt, "error": str(e)})

        # Sort by accuracy
        all_results.sort(key=lambda r: r.get("accuracy", 0), reverse=True)
        return all_results

    def list_saved_models(self) -> list:
        """List all saved models with metadata."""
        models = []
        for meta_file in sorted(self.models_dir.glob("*_meta.json")):
            try:
                with open(meta_file) as f:
                    meta = json.load(f)
                pkl_name = meta_file.stem.replace("_meta", "") + ".pkl"
                pkl_path = self.models_dir / pkl_name
                meta["available"] = pkl_path.exists()
                meta["model_file"] = pkl_name
                models.append(meta)
            except Exception as e:
                logger.warning(f"Failed to load metadata {meta_file}: {e}")
        return models

    def load_model(self, model_file: str):
        """Load a saved model."""
        path = self.models_dir / model_file
        if not path.exists():
            raise FileNotFoundError(f"Model not found: {path}")
        return joblib.load(path)

    def delete_model(self, model_file: str) -> bool:
        """Delete a saved model and its metadata."""
        pkl_path = self.models_dir / model_file
        meta_path = self.models_dir / model_file.replace(".pkl", "_meta.json")
        deleted = False
        if pkl_path.exists():
            pkl_path.unlink()
            deleted = True
        if meta_path.exists():
            meta_path.unlink()
            deleted = True
        return deleted

    def get_best_model(self) -> Optional[Dict]:
        """Get the best performing saved model."""
        models = self.list_saved_models()
        if not models:
            return None
        return max(models, key=lambda m: m.get("accuracy", 0))
