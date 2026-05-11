"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Menu, X, Activity, BarChart3, Cpu, Layers } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: Brain },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/training", label: "Training", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/models", label: "Models", icon: Layers },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1a1a1a" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Brain className="w-8 h-8 group-hover:drop-shadow-[0_0_8px_rgba(131,255,0,0.6)] transition-all" style={{ color: "#83FF00" }} />
            </div>
            <span className="text-xl font-bold neon-text tracking-wider">NEUROPILOT</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-[#83FF00] hover:bg-white/[0.03] transition-all duration-300"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
            <div className="ml-4 flex items-center gap-2">
              <span className="status-dot status-online" />
              <span className="text-xs font-medium" style={{ color: "#83FF00" }}>System Online</span>
            </div>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-gray-400 hover:text-[#83FF00]">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-[#83FF00] hover:bg-white/[0.03] transition-all"
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
