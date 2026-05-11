"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Zap, Activity, BarChart3, Cpu, Layers, ArrowRight, ChevronDown, Radio } from "lucide-react";
import Navbar from "@/components/Navbar";
import NeuralBackground from "@/components/NeuralBackground";
import EEGWaveCanvas from "@/components/EEGWaveCanvas";

const stats = [
  { label: "Classification Accuracy", value: "94.7%", icon: BarChart3 },
  { label: "Inference Latency", value: "<30ms", icon: Zap },
  { label: "ML Models Available", value: "6+", icon: Cpu },
  { label: "EEG Channels", value: "64", icon: Activity },
];

const features = [
  { title: "Real-Time BCI Dashboard", desc: "Multi-channel EEG visualization with 3D brain model and live motor cortex activation mapping.", icon: Activity },
  { title: "AI-Powered Classification", desc: "CSP, LDA, SVM, and deep CNN models for motor imagery classification with >94% accuracy.", icon: Brain },
  { title: "Automated ML Pipeline", desc: "One-click training from raw EEG data to deployed model. Auto-preprocessing, feature extraction, and evaluation.", icon: Cpu },
  { title: "Multi-Dataset Support", desc: "Built-in support for EEGMMIDB (103 subjects), BCI Competition IV, and custom EEG datasets.", icon: Layers },
  { title: "Live Prediction Engine", desc: "WebSocket-based real-time inference with decision stabilization, majority voting, and confidence thresholding.", icon: Zap },
  { title: "Advanced Analytics", desc: "Spectrograms, PSD analysis, topographic maps, confusion matrices, and cross-subject benchmarking.", icon: BarChart3 },
];

const pipeline = [
  { step: "01", title: "Brain Signal Capture", desc: "EEG electrodes capture neural electrical activity during motor imagery tasks." },
  { step: "02", title: "Signal Preprocessing", desc: "Bandpass filtering, notch filtering, ICA artifact removal, and signal normalization." },
  { step: "03", title: "Feature Extraction", desc: "CSP, Wavelet Packet Decomposition, STFT, and spectral band power analysis." },
  { step: "04", title: "AI Classification", desc: "Machine learning models classify left/right hand motor imagery with high accuracy." },
  { step: "05", title: "Decision Stabilization", desc: "Sliding window smoothing, confidence thresholding, and majority voting for robust output." },
  { step: "06", title: "Action Execution", desc: "Brain commands translated to virtual actions: cursor, drone, wheelchair, robotic arm control." },
];

const fadeUp = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6 } };

export default function HomePage() {
  return (
    <main className="relative">
      <NeuralBackground />
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <EEGWaveCanvas channels={6} height={800} speed={0.5} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm mb-8" style={{ background: "#141414", border: "1px solid #222", color: "#83FF00" }}>
              <Radio className="w-4 h-4 animate-pulse" />
              <span>EEG Brain-Computer Interface Platform</span>
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="neon-text">Control Machines</span>
            <br />
            <span className="text-white">Using Your </span>
            <span className="neon-text-purple">Mind</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: "#888" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            NeuroPilot transforms EEG brain signals into real-time motor commands using
            advanced AI. Classify left/right motor imagery, visualize neural activity,
            and deploy brain-controlled actions — all in one platform.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link href="/dashboard" className="btn-neon-solid text-lg flex items-center gap-2 group">
              Launch Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/training" className="btn-neon text-lg flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Train Model
            </Link>
          </motion.div>

          <motion.div
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-5 text-center">
                <stat.icon className="w-6 h-6 mx-auto mb-2" style={{ color: "#83FF00" }} />
                <div className="stat-value text-2xl">{stat.value}</div>
                <div className="text-xs mt-1" style={{ color: "#666" }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            className="mt-16 flex justify-center"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <ChevronDown className="w-8 h-8" style={{ color: "rgba(131,255,0,0.4)" }} />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeUp} viewport={{ once: true }} whileInView="animate" initial="initial">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="neon-text">Powerful</span> <span className="text-white">Features</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#666" }}>
              A complete ecosystem for EEG research, model training, and real-time brain-computer interaction.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-card p-6 group cursor-pointer"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-[0_0_15px_rgba(131,255,0,0.15)] transition-all" style={{ background: "rgba(131,255,0,0.08)" }}>
                  <feature.icon className="w-6 h-6" style={{ color: "#83FF00" }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#888" }}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How BCI Works */}
      <section className="relative py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeUp} viewport={{ once: true }} whileInView="animate" initial="initial">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-white">How </span><span className="neon-text-purple">BCI</span><span className="text-white"> Works</span>
            </h2>
            <p className="text-lg" style={{ color: "#666" }}>From thought to action — the complete neural pipeline.</p>
          </motion.div>

          <div className="space-y-4">
            {pipeline.map((step, i) => (
              <motion.div
                key={step.step}
                className="glass-card p-6 flex items-start gap-6"
                initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(131,255,0,0.08)", border: "1px solid rgba(131,255,0,0.15)" }}>
                  <span className="text-xl font-black neon-text">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-sm" style={{ color: "#888" }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technologies */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h2 className="text-4xl font-bold mb-12" {...fadeUp} viewport={{ once: true }} whileInView="animate" initial="initial">
            <span className="text-white">Built With </span><span className="neon-text">Cutting-Edge</span><span className="text-white"> Tech</span>
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {["Next.js", "FastAPI", "TensorFlow", "Scikit-learn", "Three.js", "WebSocket", "MNE-Python", "NumPy", "SciPy", "Framer Motion", "TailwindCSS", "Recharts"].map((tech, i) => (
              <motion.div
                key={tech}
                className="glass-card p-4 text-sm font-medium text-gray-400 hover:text-[#83FF00] transition-colors"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
              >
                {tech}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div className="glass-card p-12" {...fadeUp} viewport={{ once: true }} whileInView="animate" initial="initial">
            <Brain className="w-16 h-16 mx-auto mb-6" style={{ color: "#83FF00" }} />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">Ready to </span><span className="neon-text">Decode the Brain</span><span className="text-white">?</span>
            </h2>
            <p className="mb-8 max-w-2xl mx-auto" style={{ color: "#888" }}>
              Start exploring EEG motor imagery classification, train your own models,
              and experience real-time brain-computer interaction.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard" className="btn-neon-solid text-lg">
                Open Dashboard
              </Link>
              <Link href="/training" className="btn-neon text-lg">
                Start Training
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4" style={{ borderTop: "1px solid #1a1a1a" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: "#83FF00" }} />
            <span className="font-bold neon-text">NEUROPILOT</span>
          </div>
          <p className="text-sm" style={{ color: "#555" }}>
            B.Tech Final Year Project — EEG Brain-Computer Interface System
          </p>
          <p className="text-xs" style={{ color: "#333" }}>© 2025 NeuroPilot. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
