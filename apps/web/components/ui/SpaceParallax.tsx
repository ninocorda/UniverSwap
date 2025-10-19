"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

// Premium space background (asteroids only) with controlled cadence.
// Uses image assets from /public/space for high realism.

// Central configuration for easy tuning
const CONFIG = {
  durSec: 18,            // crossing duration (seconds)
  delays: [0, 21, 42, 63] as const, // spawn times (seconds) → ensures 1 visible with ~3s gap
  rangeMinVH: 2,         // vertical spawn range min (vh)
  rangeMaxVH: 98,        // vertical spawn range max (vh)
  minGapVH: 24,          // minimum vertical distance between different spawn tops (vh)
  jitterVH: 8,           // per-item random jitter (±vh)
};

type Item = {
  src: string;
  width: number;
  height: number;
  topVH: number; // vertical placement as vh
  delaySec: number; // animation-delay in seconds
  durSec?: number; // animation-duration in seconds (default 6s)
};

// Planets removed per request

// Base assets (will randomize vertical lanes per mount)
const BASE_ASSETS = [
  { src: "/space/images/asteroir%201.webp", width: 58, height: 30 },
  { src: "/space/images/asteroid%202.webp", width: 52, height: 28 },
  { src: "/space/images/asteroid%203.webp", width: 62, height: 33 },
  { src: "/space/images/asteroir%201.webp", width: 50, height: 26 },
] as const;

// Helper to generate N random vertical positions (vh) with much wider range and spacing
function genRandomTops(n: number, min = CONFIG.rangeMinVH, max = CONFIG.rangeMaxVH, minGap = CONFIG.minGapVH): number[] {
  const tops: number[] = [];
  let guard = 0;
  while (tops.length < n && guard++ < 200) {
    const t = Math.round(min + Math.random() * (max - min));
    if (tops.every((x) => Math.abs(x - t) >= minGap)) tops.push(t);
  }
  // Fallback to ensure length n
  while (tops.length < n) tops.push(Math.min(max, min + tops.length * minGap));
  return tops;
}

// Randomized asteroids with controlled cadence from CONFIG
const useAsteroids = () =>
  useMemo<Item[]>(() => {
    const baseTops = genRandomTops(4);
    // Add per-item jitter (±8vh) and clamp to safe bounds for extra randomness
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const tops = baseTops.map(t => {
      const jitter = (Math.random() * (CONFIG.jitterVH * 2)) - CONFIG.jitterVH;
      return Math.round(clamp(t + jitter, CONFIG.rangeMinVH, CONFIG.rangeMaxVH));
    });
    const delays = [...CONFIG.delays];
    return BASE_ASSETS.map((a, i) => ({
      src: a.src,
      width: a.width,
      height: a.height,
      topVH: tops[i],
      delaySec: delays[i],
      durSec: CONFIG.durSec,
    }));
  }, []);

// Comet and spaceships removed per request

export default function SpaceParallax() {
  const ASTEROIDS = useAsteroids();
  const [resetKey, setResetKey] = useState(0);
  const resizeTimer = useRef<number | null>(null);

  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) setResetKey((k) => k + 1);
    }
    function onResize() {
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
      resizeTimer.current = window.setTimeout(() => setResetKey((k) => k + 1), 300);
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
    };
  }, []);

  return (
    <div key={resetKey} aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      {ASTEROIDS.map((it, i) => (
        <Asteroid key={`ast-${i}`} item={it} />
      ))}
    </div>
  );
}

function Asteroid({ item }: { item: Item }) {
  const { src, width, height, topVH, delaySec, durSec = 6 } = item;
  const [y, setY] = useState<number>(topVH);

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  function nextTop(prev: number): number {
    let t = prev;
    let guard = 0;
    while (guard++ < 50) {
      const cand = Math.round(2 + Math.random() * 96); // 2..98
      if (Math.abs(cand - prev) >= 12) { t = cand; break; }
    }
    return clamp(t, 2, 98);
  }

  return (
    <div
      className="asteroid parallax-img asteroid-run"
      style={{ top: `${y}vh`, animationDelay: `${delaySec}s`, animationDuration: `${durSec}s` }}
      onAnimationIteration={() => setY((prev) => nextTop(prev))}
    >
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ width, height }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}

// CSS hooks are defined in globals.css:
// .parallax-layer { position:absolute; inset:0; width:200%; }
// .parallax-track { position:absolute; top:0; left:0; display:flex; align-items:flex-start; width:200%; animation: scrollX var(--dur) linear infinite; }
// .parallax-layer .item { position:absolute; left:0; }
// .scroll-slow { --dur: 120s; }
// .scroll-mid { --dur: 80s; }
