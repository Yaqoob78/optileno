// src/components/ui/GlassMorphBG.tsx
import React from "react";

interface GlassMorphBGProps {
  intensity?: 'light' | 'medium' | 'heavy';
}

export default function GlassMorphBG({ intensity = 'medium' }: GlassMorphBGProps) {
  const opacityMap = {
    light: 'opacity-30',
    medium: 'opacity-50',
    heavy: 'opacity-70'
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Main Glass Layer */}
      <div className={`absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-3xl ${opacityMap[intensity]}`}></div>
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        ></div>
      </div>

      {/* Floating Geometric Shapes */}
      <div className="absolute -top-20 -left-20 w-64 h-64 border border-white/10 rounded-full animate-spin-slow"></div>
      <div className="absolute -bottom-20 -right-20 w-80 h-80 border border-white/10 rounded-full animate-spin-slow-reverse"></div>
      <div className="absolute top-1/3 left-1/4 w-40 h-40 border border-white/10 rotate-45 animate-pulse-slow"></div>

      {/* Dynamic Gradient Orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96">
        <div className="absolute w-full h-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
      </div>
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96">
        <div className="absolute w-full h-full bg-gradient-to-tr from-emerald-500/20 to-amber-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Subtle Noise Texture */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }}
        ></div>
      </div>

      {/* Luxury Shine Effect */}
      <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      <div className="absolute left-0 top-1/4 w-px h-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
      <div className="absolute right-0 top-1/4 w-px h-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
    </div>
  );
}