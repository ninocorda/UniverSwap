"use client";
import { useEffect, useRef } from 'react';

export default function StarfieldCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const starsRef = useRef<{ x: number; y: number; z: number }[]>([]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
    }
    window.addEventListener('resize', resize);
    resize();

    // init stars (density scales with viewport) — denser field with size variance
    const COUNT = Math.min(1500, Math.max(420, Math.floor((window.innerWidth * window.innerHeight) / 3800)));
    starsRef.current = new Array(COUNT).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random(),
    }));

    function step() {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      // lighter fade to make stars more visible
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, width, height);

      const speed = 0.0025;
      const sx = width / 2;
      const sy = height / 2;

      for (const s of starsRef.current) {
        s.z -= speed;
        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = 1;
        }
        const k = 1 / s.z;
        const x = Math.floor(sx + s.x * k * sx);
        const y = Math.floor(sy + s.y * k * sy);
        // slight variance in size for depth perception
        const size = Math.max(1, (1 - s.z) * (2.2 + Math.random() * 0.8) * DPR);
        const alpha = Math.max(0.35, 1 - s.z);
        ctx.fillStyle = `rgba(180,220,255,${alpha})`;
        ctx.fillRect(x, y, size, size);
      }

      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 opacity-95"
      style={{ pointerEvents: 'none' }}
    />
  );
}
