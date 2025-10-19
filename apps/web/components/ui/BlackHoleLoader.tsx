"use client";
import React from 'react';

export default function BlackHoleLoader({ label = 'Warping...' }: { label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div className="relative">
        <div className="bh-core"></div>
        <div className="bh-ring bh-ring-1"></div>
        <div className="bh-ring bh-ring-2"></div>
        <div className="bh-ring bh-ring-3"></div>
      </div>
      <div className="ml-4 text-sm text-cyan-200 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]">{label}</div>
    </div>
  );
}
