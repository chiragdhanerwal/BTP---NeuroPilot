import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "NeuroPilot | Brain-Computer Interface Platform",
  description: "Advanced EEG-based Brain-Computer Interface platform for Motor Imagery classification, real-time brain-controlled actions, and AI-powered neural signal processing.",
  keywords: "BCI, EEG, Brain-Computer Interface, Motor Imagery, Neural Signal Processing, Machine Learning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ backgroundColor: '#000000', colorScheme: 'dark' }}>
      <body className={`${inter.className} min-h-screen antialiased`} style={{ backgroundColor: '#000000', color: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  );
}
