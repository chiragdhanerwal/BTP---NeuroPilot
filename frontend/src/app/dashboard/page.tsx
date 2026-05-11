"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, Brain, Zap, Radio, Play, Square, Settings, ChevronRight, Wifi, WifiOff, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import EEGWaveCanvas from "@/components/EEGWaveCanvas";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from "recharts";

const BAND_COLORS: Record<string, string> = { alpha: "#83FF00", beta: "#ff6644", theta: "#66CC00", delta: "#ff4444" };

const SIGNAL_QUALITY = [85, 72, 91, 65, 78, 43, 88, 76];

export default function DashboardPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [prediction, setPrediction] = useState({ class: "Idle", confidence: 0, probabilities: {} as Record<string, number> });
  const [bands, setBands] = useState({ alpha: 0, beta: 0, theta: 0, delta: 0 });
  const [predictionHistory, setPredictionHistory] = useState<{ time: number; left: number; right: number; rest: number }[]>([]);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const startStreaming = useCallback(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/eeg-stream");
    ws.onopen = () => { setIsStreaming(true); };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.prediction) {
        setPrediction({ class: msg.prediction.class, confidence: msg.prediction.confidence, probabilities: msg.prediction.probabilities || {} });
        setPredictionHistory(prev => {
          const p = msg.prediction.probabilities || {};
          const entry = { time: Date.now(), left: p["Left Hand"] || 0, right: p["Right Hand"] || 0, rest: p["Rest"] || 0 };
          return [...prev.slice(-50), entry];
        });
      }
      if (msg.bands) setBands(msg.bands);
    };
    ws.onclose = () => { setIsStreaming(false); };
    ws.onerror = () => {
      // Fallback to simulation
      setIsStreaming(true);
      const interval = setInterval(() => {
        const probs = { "Left Hand": Math.random() * 0.5 + 0.1, "Right Hand": Math.random() * 0.5 + 0.1, "Rest": Math.random() * 0.3 };
        const total = probs["Left Hand"] + probs["Right Hand"] + probs["Rest"];
        Object.keys(probs).forEach(k => probs[k as keyof typeof probs] /= total);
        const classes = Object.entries(probs);
        const best = classes.reduce((a, b) => a[1] > b[1] ? a : b);
        setPrediction({ class: best[0], confidence: best[1], probabilities: probs });
        setBands({ alpha: Math.random() * 15 + 5, beta: Math.random() * 12 + 3, theta: Math.random() * 8 + 2, delta: Math.random() * 6 + 1 });
        setPredictionHistory(prev => [...prev.slice(-50), { time: Date.now(), left: probs["Left Hand"], right: probs["Right Hand"], rest: probs["Rest"] }]);
      }, 200);
      wsRef.current = { close: () => { clearInterval(interval); setIsStreaming(false); } } as any;
    };
    wsRef.current = ws;
  }, []);

  const stopStreaming = useCallback(() => {
    wsRef.current?.close();
    setIsStreaming(false);
    setIsProcessing(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("idle");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/v1/inference/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadedFile(data.filename);
        setUploadStatus("success");
      } else {
        setUploadStatus("error");
      }
    } catch (err) {
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const startFileInference = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setIsStreaming(true);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/inference/predict-file?filename=${uploadedFile}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        // Playback the predictions
        const predictions = data.predictions;
        const probabilities = data.probabilities;
        
        for (let i = 0; i < predictions.length; i++) {
          if (!isStreamingRef.current) break; // Check if stopped via ref
          
          const pred = predictions[i];
          const probs = probabilities[i];
          
          // If predictions is just a list of labels
          const currentLabel = typeof pred === 'string' ? pred : pred.class;
          const currentProbs = typeof probs === 'object' ? probs : {};
          const currentConfidence = typeof pred === 'object' ? pred.confidence : 1.0;

          setPrediction({ 
            class: currentLabel, 
            confidence: currentConfidence, 
            probabilities: currentProbs 
          });

          setPredictionHistory(prev => [
            ...prev.slice(-50), 
            { 
              time: Date.now() + i * 100, 
              left: currentProbs["Left Hand"] || 0, 
              right: currentProbs["Right Hand"] || 0, 
              rest: currentProbs["Rest"] || 0 
            }
          ]);

          // Simulate bands for visualization
          setBands({ 
            alpha: Math.random() * 15 + 5, 
            beta: Math.random() * 12 + 3, 
            theta: Math.random() * 8 + 2, 
            delta: Math.random() * 6 + 1 
          });

          await new Promise(resolve => setTimeout(resolve, 500)); // Playback speed
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setIsStreaming(false);
    }
  };

  const onStart = () => {
    if (uploadedFile) {
      startFileInference();
    } else {
      startStreaming();
    }
  };

  const bandData = Object.entries(bands).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Number(value), fill: BAND_COLORS[name] || "#83FF00" }));

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold"><span className="neon-text">BCI</span> Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Real-time Brain-Computer Interface Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              {isStreaming ? <Wifi className="w-4 h-4 text-[#83FF00]" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
              <span className="text-sm">{isStreaming ? "Streaming" : "Offline"}</span>
            </div>
            {!isStreaming ? (
              <button onClick={onStart} className="btn-neon-solid flex items-center gap-2 !py-2 !px-5 text-sm" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 
                {uploadedFile ? "Start Prediction" : "Start Live Stream"}
              </button>
            ) : (
              <button onClick={stopStreaming} className="btn-neon flex items-center gap-2 !py-2 !px-5 text-sm !border-red-500/50 !text-red-400">
                <Square className="w-4 h-4" /> Stop
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - EEG Signals */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#83FF00]" />
                  <h2 className="font-bold text-sm">Upload EEG File</h2>
                </div>
                {uploadStatus === "success" && <CheckCircle2 className="w-4 h-4 text-[#83FF00]" />}
                {uploadStatus === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>
              
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading || isStreaming}
                />
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${uploadedFile ? 'border-[#83FF00]/50 bg-[#83FF00]/5' : 'border-white/10 hover:border-white/20'}`}>
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#83FF00]" />
                      <span className="text-xs text-gray-400">Uploading...</span>
                    </div>
                  ) : uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-6 h-6 text-[#83FF00]" />
                      <span className="text-xs font-medium text-white truncate max-w-full px-4">{uploadedFile}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setUploadStatus("idle"); }}
                        className="text-[10px] text-red-400 hover:text-red-300 underline"
                      >
                        Clear File
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-gray-500 group-hover:text-gray-400" />
                      <span className="text-xs text-gray-400">Drop EEG CSV file or click to upload</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 text-center italic">
                Upload a channel-major EEG CSV file from the EEGMMIDB dataset.
              </p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#83FF00]" />
                <h2 className="font-bold text-sm">Multi-Channel EEG</h2>
              </div>
              <EEGWaveCanvas channels={8} height={200} speed={isStreaming ? 1 : 0.2} />
            </div>
            
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#ff6644]" /> Frequency Bands
              </h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandData} barSize={30}>
                    <XAxis dataKey="name" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {bandData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.7} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {Object.entries(bands).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: BAND_COLORS[name] }} />
                      <span className="text-xs capitalize text-gray-400">{name}</span>
                    </div>
                    <span className="text-xs font-mono text-white">{Number(value).toFixed(1)} µV</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Panel - Brain Model & Prediction */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card p-6 text-center">
              <h3 className="font-bold text-sm mb-4 flex items-center justify-center gap-2">
                <Brain className="w-5 h-5 text-[#83FF00]" /> Motor Cortex Activity
              </h3>
              <div className="relative w-48 h-48 mx-auto mb-4">
                {/* Brain outline SVG */}
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <ellipse cx="100" cy="100" rx="85" ry="90" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="2" />
                  <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
                  {/* Left hemisphere */}
                  <ellipse cx="60" cy="80" rx="30" ry="25" fill={prediction.class === "Left Hand" ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.05)"} stroke={prediction.class === "Left Hand" ? "#83FF00" : "rgba(0,212,255,0.2)"} strokeWidth="1.5" className="transition-all duration-300" />
                  {/* Right hemisphere */}
                  <ellipse cx="140" cy="80" rx="30" ry="25" fill={prediction.class === "Right Hand" ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.05)"} stroke={prediction.class === "Right Hand" ? "#ff6644" : "rgba(245,158,11,0.2)"} strokeWidth="1.5" className="transition-all duration-300" />
                  {/* Labels */}
                  <text x="60" y="85" textAnchor="middle" fill={prediction.class === "Left Hand" ? "#83FF00" : "#555"} fontSize="10" fontWeight="bold">L</text>
                  <text x="140" y="85" textAnchor="middle" fill={prediction.class === "Right Hand" ? "#ff6644" : "#555"} fontSize="10" fontWeight="bold">R</text>
                  <text x="100" y="160" textAnchor="middle" fill="#666" fontSize="8">Motor Cortex</text>
                </svg>
                {(prediction.class === "Left Hand" || prediction.class === "Right Hand") && (
                  <motion.div className="absolute inset-0 rounded-full" style={{ background: prediction.class === "Left Hand" ? "radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)" : "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)" }} animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
                )}
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Current Decision</div>
                <motion.div className="text-2xl font-black" key={prediction.class} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <span className={prediction.class === "Left Hand" ? "text-[#83FF00]" : prediction.class === "Right Hand" ? "text-[#ff6644]" : "text-gray-500"}>
                    {prediction.class}
                  </span>
                </motion.div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[#83FF00] to-[#66CC00]" animate={{ width: `${prediction.confidence * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className="text-xs font-mono text-[#83FF00]">{(prediction.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Prediction History */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">Prediction Probabilities</h3>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={predictionHistory.slice(-30)}>
                    <defs>
                      <linearGradient id="leftGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#83FF00" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#83FF00" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff6644" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ff6644" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="left" stroke="#83FF00" fill="url(#leftGrad)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="right" stroke="#ff6644" fill="url(#rightGrad)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="rest" stroke="#666" fill="transparent" strokeWidth={1} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#83FF00] inline-block" /> Left</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#ff6644] inline-block" /> Right</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500 inline-block" style={{ borderTop: "1px dashed" }} /> Rest</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Controls & Simulation */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> AI Prediction Panel
              </h3>
              <div className="space-y-3">
                {Object.entries(prediction.probabilities).map(([cls, prob]) => (
                  <div key={cls}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{cls}</span>
                      <span className="font-mono text-white">{(Number(prob) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${cls === "Left Hand" ? "bg-[#83FF00]" : cls === "Right Hand" ? "bg-[#ff6644]" : "bg-gray-500"}`} animate={{ width: `${Number(prob) * 100}%` }} transition={{ duration: 0.3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Virtual Control Simulation */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">🎮 Virtual Control</h3>
              <div className="relative w-full h-40 rounded-xl bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 overflow-hidden">
                {/* Cursor simulation */}
                <motion.div 
                  className="absolute w-4 h-4 rounded-full"
                  style={{ background: "radial-gradient(circle, #83FF00, transparent)" }}
                  animate={{ 
                    x: prediction.class === "Left Hand" ? "20%" : prediction.class === "Right Hand" ? "80%" : "50%",
                    y: "50%",
                  }}
                  transition={{ type: "spring", stiffness: 100 }}
                />
                <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-gray-600">
                  Cursor Control Simulation
                </div>
                {/* Direction indicators */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[#83FF00]/50">← Left</div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#ff6644]/50">Right →</div>
              </div>
            </div>

            {/* Signal Quality */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">📡 Signal Quality</h3>
              <div className="grid grid-cols-4 gap-2">
                {SIGNAL_QUALITY.map((quality, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center text-xs font-bold ${quality > 70 ? "bg-[#83FF00]/20 text-[#83FF00]" : quality > 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                      {i + 1}
                    </div>
                    <span className="text-[10px] text-gray-500">Ch{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
