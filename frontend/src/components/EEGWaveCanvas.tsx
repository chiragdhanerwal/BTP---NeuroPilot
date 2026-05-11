"use client";
import { useEffect, useRef } from "react";

interface EEGWaveProps {
  channels?: number;
  color?: string;
  height?: number;
  speed?: number;
  className?: string;
}

export default function EEGWaveCanvas({ channels = 4, color = "#83FF00", height = 200, speed = 1, className = "" }: EEGWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.clientWidth * 2;
      canvas.height = height * 2;
    };
    resize();

    const COLORS = ["#83FF00", "#AAFF32", "#66CC00", "#83FF00", "#AAFF32", "#66CC00", "#83FF00", "#AAFF32"];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const chHeight = canvas.height / channels;

      for (let ch = 0; ch < channels; ch++) {
        const y0 = chHeight * ch + chHeight / 2;
        ctx.beginPath();
        ctx.strokeStyle = COLORS[ch % COLORS.length];
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;

        for (let x = 0; x < canvas.width; x++) {
          const t = (x / canvas.width) * 10 + time * speed;
          const freq1 = 10 + ch * 2;
          const freq2 = 20 + ch;
          const y = y0 + 
            Math.sin(t * freq1 * 0.1) * (chHeight * 0.2) +
            Math.sin(t * freq2 * 0.1) * (chHeight * 0.1) +
            Math.sin(t * 3 + ch) * (chHeight * 0.05) +
            (Math.random() - 0.5) * 4;
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      time += 0.016;
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animId);
  }, [channels, color, height, speed]);

  return <canvas ref={canvasRef} className={`w-full ${className}`} style={{ height }} />;
}
