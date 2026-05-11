"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Activity, Brain, TrendingUp, Zap, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import EEGWaveCanvas from "@/components/EEGWaveCanvas";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, CartesianGrid } from "recharts";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Generate demo data
  const bandPowerData = [
    { band: "Delta", power: 12, color: "#ff4444" },
    { band: "Theta", power: 18, color: "#ffaa00" },
    { band: "Alpha", power: 35, color: "#83FF00" },
    { band: "Beta", power: 28, color: "#ff6644" },
    { band: "Gamma", power: 7, color: "#66CC00" },
  ];

  const accuracyHistory = Array.from({ length: 20 }, (_, i) => ({
    epoch: i + 1,
    accuracy: Math.min(0.95, 0.5 + i * 0.025 + Math.random() * 0.03),
    loss: Math.max(0.1, 0.8 - i * 0.035 + Math.random() * 0.02),
  }));

  const modelComparison = [
    { model: "CSP+LDA", accuracy: 89, precision: 87, recall: 88, f1: 87 },
    { model: "CSP+SVM", accuracy: 92, precision: 91, recall: 90, f1: 90 },
    { model: "Spectral+LDA", accuracy: 85, precision: 83, recall: 84, f1: 83 },
    { model: "Spectral+SVM", accuracy: 88, precision: 86, recall: 87, f1: 86 },
  ];

  const channelActivity = Array.from({ length: 64 }, (_, i) => ({
    channel: `Ch${i + 1}`,
    activity: Math.random() * 100,
  }));

  const latencyData = Array.from({ length: 50 }, (_, i) => ({
    sample: i,
    latency: 20 + Math.random() * 30,
    confidence: 0.6 + Math.random() * 0.35,
  }));

  const radarData = [
    { metric: "Accuracy", A: 92, B: 89 },
    { metric: "Precision", A: 91, B: 87 },
    { metric: "Recall", A: 90, B: 88 },
    { metric: "F1 Score", A: 90, B: 87 },
    { metric: "Speed", A: 75, B: 95 },
    { metric: "Stability", A: 88, B: 82 },
  ];

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "signals", label: "EEG Signals", icon: Activity },
    { id: "models", label: "Model Comparison", icon: Brain },
    { id: "latency", label: "Latency", icon: Zap },
  ];

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 max-w-[1600px] mx-auto pb-16">
        <div className="mb-6">
          <h1 className="text-3xl font-bold"><span className="neon-text">Performance</span> Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Advanced EEG analytics, model benchmarking, and signal analysis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.id ? "bg-[#83FF00]/10 text-[#83FF00] border border-green-500/30" : "text-gray-500 hover:text-gray-300 border border-transparent"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Best Accuracy", value: "94.7%", trend: "+2.3%", color: "text-[#83FF00]" },
                { label: "Avg Latency", value: "28ms", trend: "-5ms", color: "text-[#83FF00]" },
                { label: "Models Trained", value: "12", trend: "+3", color: "text-[#ff6644]" },
                { label: "Avg Confidence", value: "91.2%", trend: "+1.8%", color: "text-pink-400" },
              ].map(s => (
                <div key={s.label} className="glass-card p-5">
                  <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-[#83FF00] mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{s.trend}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Band Power */}
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4">Frequency Band Power Distribution</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bandPowerData} barSize={40}>
                      <XAxis dataKey="band" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0f0f2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="power" radius={[6, 6, 0, 0]}>
                        {bandPowerData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.7} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Training History */}
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4">Training Accuracy & Loss</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accuracyHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="epoch" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0f0f2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px", fontSize: "12px" }} />
                      <Line type="monotone" dataKey="accuracy" stroke="#83FF00" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="loss" stroke="#ff4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#83FF00] inline-block" /> Accuracy</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" /> Loss</span>
                </div>
              </div>
            </div>

            {/* Radar comparison */}
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4">Model Performance Radar</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#8888aa", fontSize: 11 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    <Radar name="CSP+SVM" dataKey="A" stroke="#83FF00" fill="#83FF00" fillOpacity={0.15} strokeWidth={2} />
                    <Radar name="CSP+LDA" dataKey="B" stroke="#ff6644" fill="#ff6644" fillOpacity={0.1} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 text-xs mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#83FF00] inline-block" /> CSP+SVM</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#ff6644] inline-block" /> CSP+LDA</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "signals" && (
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#83FF00]" /> Live EEG Signal Viewer</h3>
              <EEGWaveCanvas channels={8} height={400} speed={0.8} />
            </div>
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4">Channel Activity Heatmap (64 channels)</h3>
              <div className="grid grid-cols-8 gap-1">
                {channelActivity.slice(0, 64).map((ch, i) => (
                  <div key={i} className="aspect-square rounded-md flex items-center justify-center text-[8px] font-bold" style={{ background: `rgba(0, 212, 255, ${ch.activity / 100 * 0.5})`, color: ch.activity > 50 ? "#fff" : "#666" }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>Low Activity</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="w-4 h-3 rounded-sm" style={{ background: `rgba(0, 212, 255, ${(i + 1) / 20})` }} />
                  ))}
                </div>
                <span>High Activity</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "models" && (
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4">Model Comparison Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Model</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Accuracy</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Precision</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Recall</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">F1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelComparison.map((m, i) => (
                      <tr key={m.model} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition">
                        <td className="py-3 px-4 font-medium">{m.model}</td>
                        <td className="py-3 px-4 text-center"><span className="text-[#83FF00] font-bold">{m.accuracy}%</span></td>
                        <td className="py-3 px-4 text-center">{m.precision}%</td>
                        <td className="py-3 px-4 text-center">{m.recall}%</td>
                        <td className="py-3 px-4 text-center">{m.f1}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4">Accuracy Comparison</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelComparison} barSize={30}>
                    <XAxis dataKey="model" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[70, 100]} tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0f0f2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px" }} />
                    <Bar dataKey="accuracy" fill="#83FF00" fillOpacity={0.7} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === "latency" && (
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Prediction Latency</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyData}>
                    <defs>
                      <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#83FF00" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#83FF00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="sample" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0f0f2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="latency" stroke="#83FF00" fill="url(#latGrad)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4">Confidence Distribution</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyData}>
                    <defs>
                      <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff6644" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ff6644" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="sample" tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 1]} tick={{ fill: "#8888aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0f0f2a", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="confidence" stroke="#ff6644" fill="url(#confGrad)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
