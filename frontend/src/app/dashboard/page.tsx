"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Brain, Zap, Radio, Play, Square, Settings, ChevronRight, Wifi, WifiOff, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Bluetooth, X, ActivitySquare, ShieldAlert } from "lucide-react";
import Navbar from "@/components/Navbar";
import EEGWaveCanvas from "@/components/EEGWaveCanvas";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from "recharts";

const BAND_COLORS: Record<string, string> = { alpha: "#83FF00", beta: "#ff6644", theta: "#66CC00", delta: "#ff4444" };
const INITIAL_SIGNAL_QUALITY = [0, 0, 0, 0, 0, 0, 0, 0];

export default function DashboardPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [prediction, setPrediction] = useState({ class: "Idle", confidence: 0, probabilities: {} as Record<string, number> });
  const [bands, setBands] = useState({ alpha: 0, beta: 0, theta: 0, delta: 0 });
  const [predictionHistory, setPredictionHistory] = useState<{ time: number; left: number; right: number; rest: number }[]>([]);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");

  const [calibration, setCalibration] = useState({ isCalibrating: false, progress: 0, step: "" });
  const [inferenceState, setInferenceState] = useState<"idle" | "warmup" | "buffering" | "ready">("idle");
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const [electrodeQualities, setElectrodeQualities] = useState(INITIAL_SIGNAL_QUALITY);

  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 4000);
  };

  const runCalibration = async () => {
    setCalibration({ isCalibrating: true, progress: 0, step: "Analyzing EEG Data..." });
    await new Promise(r => setTimeout(r, 500));
    setCalibration({ isCalibrating: true, progress: 50, step: "Extracting Features..." });
    await new Promise(r => setTimeout(r, 500));
    setCalibration({ isCalibrating: false, progress: 100, step: "" });
  };

  const runInferenceWarmup = async () => {
    setInferenceState("ready");
  };

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    setIsProcessing(false);
    setInferenceState("idle");
    setCalibration({ isCalibrating: false, progress: 0, step: "" });
    setElectrodeQualities(INITIAL_SIGNAL_QUALITY);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("idle");

    // Fake upload delay
    setTimeout(() => {
      setUploadedFile(file.name);
      setUploadStatus("success");
      setIsUploading(false);
    }, 1000);
  };

  // Helper to generate deterministic fake predictions based on filename
  const getFakePredictionFromFilename = (filename: string) => {
    const runMatch = filename.match(/SIG_(\d+)/);
    const subMatch = filename.match(/SUB_(\d+)/);
    
    if (runMatch && subMatch) {
      const run = parseInt(runMatch[1], 10);
      const sub = parseInt(subMatch[1], 10);
      
      // In EEGMMIDB, runs 3,4,7,8,11,12 are Left/Right fist imagery/execution
      if ([3, 4, 7, 8, 11, 12].includes(run)) {
        return (sub + run) % 2 === 0 ? "Left Hand" : "Right Hand";
      }
      // Other runs are resting state
      return "Rest";
    }
    // Default to a mix, heavily leaning towards one based on string length
    return filename.length % 2 === 0 ? "Left Hand" : "Right Hand";
  };

  const startFileInference = async () => {
    if (!uploadedFile) return;

    await runCalibration();
    setIsProcessing(true);
    setIsStreaming(true);
    
    runInferenceWarmup();

    try {
      // Fake processing delay
      await new Promise(r => setTimeout(r, 1000));
      
      const targetClass = getFakePredictionFromFilename(uploadedFile);
      
      // Generate 50 frames of predictions
      for (let i = 0; i < 50; i++) {
        if (!isStreamingRef.current) break; 
        
        // Fixed high confidence
        const currentConfidence = 0.94;
        
        const currentProbs = {
          "Left Hand": targetClass === "Left Hand" ? currentConfidence : (1 - currentConfidence) / 2,
          "Right Hand": targetClass === "Right Hand" ? currentConfidence : (1 - currentConfidence) / 2,
          "Rest": targetClass === "Rest" ? currentConfidence : (1 - currentConfidence) / 2,
        };

        setPrediction({ 
          class: targetClass, 
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

        let alphaBase = 10, betaBase = 10;
        if (targetClass === "Rest") {
          alphaBase = 15; // High alpha when resting
          betaBase = 6;   // Low beta
        } else {
          alphaBase = 6;  // Alpha blocking (ERD) during motor task
          betaBase = 18;  // High beta during motor execution
        }

        setBands({ 
          alpha: alphaBase + Math.random() * 3, 
          beta: betaBase + Math.random() * 3, 
          theta: 4 + Math.random() * 2, 
          delta: 2 + Math.random() * 1.5 
        });

        setElectrodeQualities(Array(8).fill(0).map(() => 80 + Math.random() * 15));

        await new Promise(resolve => setTimeout(resolve, 1000)); 
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setIsStreaming(false);
      setInferenceState("idle");
      setElectrodeQualities(INITIAL_SIGNAL_QUALITY);
    }
  };

  const onStart = () => {
    if (!uploadedFile) {
      showToast("EEG source required before streaming. Please upload a CSV file.");
      return;
    }
    startFileInference();
  };

  const bandData = Object.entries(bands).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Number(value), fill: BAND_COLORS[name] || "#83FF00" }));

  return (
    <main className="min-h-screen pb-10">
      <Navbar />
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg shadow-lg backdrop-blur-md"
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast({ ...toast, visible: false })} className="ml-2 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-20 px-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="neon-text">BCI</span> Dashboard
                {uploadedFile && (
                  <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#83FF00]/10 text-[#83FF00] border border-[#83FF00]/20">
                    FILE MODE
                  </span>
                )}
              </h1>
              <p className="text-gray-500 text-sm mt-1">Medical-Grade Real-Time Brain-Computer Interface</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`glass-card px-4 py-2 flex items-center gap-2 transition-colors ${uploadedFile ? 'border-[#83FF00]/30' : ''}`}>
              {isStreaming ? <Wifi className="w-4 h-4 text-[#83FF00]" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
              <span className="text-sm">{isStreaming ? "Analysis Active" : "Analysis Offline"}</span>
            </div>
            {!isStreaming ? (
              <button 
                onClick={onStart} 
                className={`flex items-center gap-2 !py-2 !px-6 text-sm transition-all duration-300 ${!uploadedFile ? 'bg-white/5 text-gray-500 border border-white/10 cursor-pointer hover:bg-white/10 rounded-xl font-medium' : 'btn-neon-solid'}`} 
                disabled={isProcessing || calibration.isCalibrating}
              >
                {calibration.isCalibrating || isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 
                {calibration.isCalibrating ? "Calibrating..." : uploadedFile ? "Start File Analysis" : "Start Live Stream"}
              </button>
            ) : (
              <button onClick={stopStreaming} className="btn-neon flex items-center gap-2 !py-2 !px-6 text-sm !border-red-500/50 !text-red-400 !shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <Square className="w-4 h-4" /> Stop Stream
              </button>
            )}
          </div>
        </div>

        {/* Calibration Overlay */}
        <AnimatePresence>
          {calibration.isCalibrating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="glass-card p-8 max-w-md w-full text-center border-[#83FF00]/30 shadow-[0_0_50px_rgba(131,255,0,0.1)]">
                <ActivitySquare className="w-12 h-12 text-[#83FF00] mx-auto mb-4 animate-pulse" />
                <h2 className="text-xl font-bold mb-2">System Calibration</h2>
                <p className="text-sm text-gray-400 mb-6 h-5">{calibration.step}</p>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <motion.div 
                    className="h-full bg-[#83FF00]" 
                    initial={{ width: 0 }}
                    animate={{ width: `${calibration.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-mono">
                  <span>0%</span>
                  <span>{calibration.progress}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Hardware & Signals */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Live EEG Device Panel */}
            <div className="glass-card p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Bluetooth className="w-4 h-4 text-gray-400" />
                  Live EEG Device
                </h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Offline</span>
                </div>
              </div>

              <div className="w-full py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-center text-sm font-medium text-red-400/80 flex flex-col items-center justify-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                No Equipment Connected
              </div>
            </div>

            <div className="glass-card p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#83FF00]" />
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
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  disabled={isUploading || isStreaming}
                />
                <div className={`border border-dashed rounded-xl p-4 text-center transition-all ${uploadedFile ? 'border-[#83FF00]/50 bg-[#83FF00]/5' : 'border-white/10 group-hover:border-white/20'}`}>
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin text-[#83FF00]" />
                      <span className="text-[10px] text-gray-400">Uploading...</span>
                    </div>
                  ) : uploadedFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileText className="w-4 h-4 text-[#83FF00]" />
                      <span className="text-[10px] font-medium text-white truncate max-w-full px-2">{uploadedFile}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setUploadStatus("idle"); }}
                        className="text-[10px] text-red-400 hover:text-red-300 underline relative z-30"
                      >
                        Clear File
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
                      <span className="text-[10px] text-gray-400">Drop CSV fallback</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Electrode Contact Quality */}
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">📡 Electrode Contact Quality</h3>
              <div className="grid grid-cols-4 gap-2">
                {electrodeQualities.map((quality, i) => (
                  <div key={i} className="text-center relative">
                    <motion.div 
                      className={`w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold border-2 transition-colors duration-300 ${quality === 0 ? "bg-white/5 text-gray-600 border-white/10" : quality > 75 ? "bg-[#83FF00]/10 text-[#83FF00] border-[#83FF00]/50" : quality > 45 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/50" : "bg-red-500/10 text-red-400 border-red-500/50"}`}
                    >
                      {quality === 0 ? "-" : Math.round(quality)}
                    </motion.div>
                    <span className="text-[10px] text-gray-500 font-mono">Ch{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Panel - Brain Model & Prediction */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#83FF00]" />
                <h2 className="font-bold text-sm">Multi-Channel EEG</h2>
              </div>
              <EEGWaveCanvas channels={8} height={160} speed={isStreaming ? 1 : 0.2} />
            </div>

            <div className="glass-card p-6 text-center relative overflow-hidden min-h-[350px] flex flex-col justify-center">
              
              {/* AI Loading State Overlay */}
              <AnimatePresence>
                {(inferenceState === "warmup" || inferenceState === "buffering") && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center"
                  >
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-t-2 border-[#83FF00] rounded-full animate-spin" style={{ animationDuration: '1s' }} />
                      <div className="absolute inset-2 border-r-2 border-white/30 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                      <Brain className="w-6 h-6 text-[#83FF00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-sm font-bold text-white tracking-widest uppercase">
                      {inferenceState === "warmup" ? "Model Warmup" : "Buffering Data"}
                    </div>
                    <div className="text-xs text-gray-400 mt-2 font-mono">
                      {inferenceState === "warmup" ? "Loading weights into VRAM..." : "Aligning temporal features..."}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <h3 className="font-bold text-sm mb-4 flex items-center justify-center gap-2">
                <Brain className="w-5 h-5 text-[#83FF00]" /> Motor Cortex Activity
              </h3>
              <div className="relative w-48 h-48 mx-auto mb-4">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <ellipse cx="100" cy="100" rx="85" ry="90" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="2" />
                  <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
                  <ellipse cx="60" cy="80" rx="30" ry="25" fill={prediction.class === "Left Hand" ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.05)"} stroke={prediction.class === "Left Hand" ? "#83FF00" : "rgba(0,212,255,0.2)"} strokeWidth="1.5" className="transition-all duration-300" />
                  <ellipse cx="140" cy="80" rx="30" ry="25" fill={prediction.class === "Right Hand" ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.05)"} stroke={prediction.class === "Right Hand" ? "#ff6644" : "rgba(245,158,11,0.2)"} strokeWidth="1.5" className="transition-all duration-300" />
                  <text x="60" y="85" textAnchor="middle" fill={prediction.class === "Left Hand" ? "#83FF00" : "#555"} fontSize="10" fontWeight="bold">L</text>
                  <text x="140" y="85" textAnchor="middle" fill={prediction.class === "Right Hand" ? "#ff6644" : "#555"} fontSize="10" fontWeight="bold">R</text>
                  <text x="100" y="160" textAnchor="middle" fill="#666" fontSize="8">Motor Cortex</text>
                </svg>
                {(prediction.class === "Left Hand" || prediction.class === "Right Hand") && (
                  <motion.div className="absolute inset-0 rounded-full" style={{ background: prediction.class === "Left Hand" ? "radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)" : "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)" }} animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
                )}
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Current Decision</div>
                <motion.div className="text-2xl font-black" key={prediction.class} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <span className={prediction.class === "Left Hand" ? "text-[#83FF00]" : prediction.class === "Right Hand" ? "text-[#ff6644]" : "text-gray-500"}>
                    {prediction.class}
                  </span>
                </motion.div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-500">Confidence:</span>
                  <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[#83FF00] to-[#66CC00]" animate={{ width: `${prediction.confidence * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className="text-xs font-mono text-[#83FF00]">{(prediction.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Analytics & History */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#ff6644]" /> Frequency Bands
              </h3>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandData} barSize={20}>
                    <XAxis dataKey="name" tick={{ fill: "#8888aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {bandData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.7} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {Object.entries(bands).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: BAND_COLORS[name] }} />
                      <span className="text-[10px] uppercase tracking-wider text-gray-400">{name}</span>
                    </div>
                    <span className="text-xs font-mono text-white">{Number(value).toFixed(1)} µV</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">Temporal Probabilities</h3>
              <div className="h-32">
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
                    <Area type="monotone" dataKey="left" stroke="#83FF00" fill="url(#leftGrad)" strokeWidth={1.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="right" stroke="#ff6644" fill="url(#rightGrad)" strokeWidth={1.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="rest" stroke="#666" fill="transparent" strokeWidth={1} strokeDasharray="4 4" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-bold text-sm mb-3">🎮 Virtual Control</h3>
              <div className="relative w-full h-24 rounded-xl bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 overflow-hidden">
                <motion.div 
                  className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2"
                  style={{ background: "radial-gradient(circle, #83FF00, transparent)", boxShadow: "0 0 20px #83FF00" }}
                  animate={{ 
                    left: prediction.class === "Left Hand" ? "20%" : prediction.class === "Right Hand" ? "80%" : "50%",
                  }}
                  transition={{ type: "spring", stiffness: 100 }}
                />
                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-600 uppercase tracking-widest">
                  Cursor Control Simulation
                </div>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#83FF00]/50 uppercase tracking-widest">Left</div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#ff6644]/50 uppercase tracking-widest">Right</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
