"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layers, Download, Trash2, Play, CheckCircle, Clock, Database, Cpu, BarChart3, Shield } from "lucide-react";
import Navbar from "@/components/Navbar";

const DEMO_MODELS = [
  { model_name: "CSP + LDA", model_type: "csp_lda", accuracy: 0.912, precision: 0.905, recall: 0.908, f1: 0.906, cv_mean: 0.889, training_time: 2.4, n_train: 150, n_test: 38, timestamp: "2025-05-10T02:15:00", model_file: "csp_lda_20250510.pkl", available: true },
  { model_name: "CSP + SVM", model_type: "csp_svm", accuracy: 0.947, precision: 0.942, recall: 0.938, f1: 0.940, cv_mean: 0.921, training_time: 4.1, n_train: 150, n_test: 38, timestamp: "2025-05-10T01:30:00", model_file: "csp_svm_20250510.pkl", available: true },
  { model_name: "Spectral + LDA", model_type: "spectral_lda", accuracy: 0.856, precision: 0.848, recall: 0.852, f1: 0.850, cv_mean: 0.832, training_time: 1.8, n_train: 200, n_test: 50, timestamp: "2025-05-09T18:00:00", model_file: "spectral_lda_20250509.pkl", available: true },
  { model_name: "Spectral + SVM", model_type: "spectral_svm", accuracy: 0.883, precision: 0.876, recall: 0.879, f1: 0.877, cv_mean: 0.861, training_time: 3.6, n_train: 200, n_test: 50, timestamp: "2025-05-09T16:45:00", model_file: "spectral_svm_20250509.pkl", available: true },
];

export default function ModelsPage() {
  const [models, setModels] = useState(DEMO_MODELS);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [deployedModel, setDeployedModel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Try to load from API
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_URL}/api/v1/training/models`)
      .then(res => res.json())
      .then(data => {
        if (data.models?.length > 0) setModels(data.models);
      })
      .catch(() => {}); // Use demo data
  }, []);

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 max-w-6xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold"><span className="neon-text">Saved</span> Models</h1>
            <p className="text-gray-500 text-sm mt-1">Manage trained models and deploy for real-time inference</p>
          </div>
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#83FF00]" />
            <span className="text-sm font-medium">{models.length} Models</span>
          </div>
        </div>

        {/* Model Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {models.map((model, i) => (
            <motion.div
              key={model.model_file || i}
              className={`glass-card p-5 cursor-pointer transition-all ${selectedModel === model.model_file ? "!border-green-500/50" : ""} ${deployedModel === model.model_file ? "!border-green-500/30 !bg-[#83FF00]/[0.03]" : ""}`}
              onClick={() => setSelectedModel(model.model_file)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#83FF00]/20 to-[#83FF00]/5 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-[#83FF00]" />
                  </div>
                  <div>
                    <h3 className="font-bold">{model.model_name}</h3>
                    <p className="text-xs text-gray-500">{model.model_type}</p>
                  </div>
                </div>
                {deployedModel === model.model_file && (
                  <span className="px-2 py-0.5 rounded-full bg-[#83FF00]/20 text-[#83FF00] text-xs font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#83FF00] animate-pulse" /> Deployed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <div className="text-lg font-black text-[#83FF00]">{(model.accuracy * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-500">Accuracy</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <div className="text-lg font-black text-[#ff6644]">{(model.f1 * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-500">F1 Score</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <div className="text-lg font-black text-[#83FF00]">{model.training_time.toFixed(1)}s</div>
                  <div className="text-[10px] text-gray-500">Train Time</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {mounted ? new Date(model.timestamp).toLocaleDateString() : "—"}</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {model.n_train + model.n_test} samples</span>
              </div>

              {selectedModel === model.model_file && (
                <motion.div className="flex gap-2 mt-4 pt-4 border-t border-white/5" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeployedModel(model.model_file); }}
                    className="btn-neon-solid !py-2 !px-4 text-xs flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" /> Deploy
                  </button>
                  <button className="btn-neon !py-2 !px-4 text-xs flex items-center gap-1">
                    <Download className="w-3 h-3" /> Export
                  </button>
                  <button className="btn-neon !py-2 !px-4 text-xs flex items-center gap-1 !border-red-500/30 !text-red-400">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Best Model Highlight */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-yellow-400" />
            <h2 className="text-lg font-bold">Best Performing Model</h2>
          </div>
          {(() => {
            const best = [...models].sort((a, b) => b.accuracy - a.accuracy)[0];
            return (
              <div className="grid md:grid-cols-5 gap-4">
                <div className="md:col-span-1">
                  <div className="text-sm text-gray-400 mb-1">Model</div>
                  <div className="font-bold text-lg neon-text">{best.model_name}</div>
                </div>
                {[
                  { label: "Accuracy", value: (best.accuracy * 100).toFixed(1) + "%" },
                  { label: "Precision", value: (best.precision * 100).toFixed(1) + "%" },
                  { label: "Recall", value: (best.recall * 100).toFixed(1) + "%" },
                  { label: "CV Score", value: (best.cv_mean * 100).toFixed(1) + "%" },
                ].map(m => (
                  <div key={m.label}>
                    <div className="text-sm text-gray-400 mb-1">{m.label}</div>
                    <div className="text-xl font-bold">{m.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}
