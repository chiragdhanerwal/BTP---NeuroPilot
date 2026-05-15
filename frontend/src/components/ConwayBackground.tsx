"use client";
import { useEffect, useRef } from "react";

const CELL_SIZE = 15; // Size of each cell
const FPS = 12; // Update speed

export default function ConwayBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let grid: boolean[][] = [];
    let cols = 0;
    let rows = 0;
    
    // For limiting FPS
    let lastTime = 0;
    const interval = 1000 / FPS;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / CELL_SIZE);
      rows = Math.floor(canvas.height / CELL_SIZE);
      
      // Initialize grid with 15% probability of a cell being alive
      grid = Array.from({ length: cols }, () =>
        Array.from({ length: rows }, () => Math.random() > 0.85)
      );
    };

    window.addEventListener("resize", resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Beautiful neon green with low opacity for background
      ctx.fillStyle = "rgba(131, 255, 0, 0.08)"; 

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (grid[i][j]) {
            // Draw cells with a tiny gap for grid effect
            ctx.fillRect(i * CELL_SIZE + 1, j * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        }
      }
    };

    const updateGrid = () => {
      const newGrid = Array.from({ length: cols }, () => Array(rows).fill(false));

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          let neighbors = 0;
          // Count live neighbors (wrapping around edges)
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              if (x === 0 && y === 0) continue;
              const col = (i + x + cols) % cols;
              const row = (j + y + rows) % rows;
              if (grid[col][row]) neighbors++;
            }
          }

          // Apply Conway's rules
          if (grid[i][j]) {
            newGrid[i][j] = neighbors === 2 || neighbors === 3;
          } else {
            newGrid[i][j] = neighbors === 3;
          }
        }
      }
      grid = newGrid;
      
      // Inject random life to keep the animation going over time
      if (Math.random() < 0.2) {
        const randX = Math.floor(Math.random() * cols);
        const randY = Math.floor(Math.random() * rows);
        grid[randX][randY] = true;
      }
    };

    const loop = (time: number) => {
      animationFrameId = requestAnimationFrame(loop);
      if (time - lastTime < interval) return;
      lastTime = time;

      updateGrid();
      draw();
    };

    loop(0);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1]"
      style={{ opacity: 0.8 }}
    />
  );
}
