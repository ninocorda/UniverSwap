"use client";
import { useEffect, useRef } from 'react';

// Lightweight parallax decorative planets/ships across the homepage
export default function ScrollDecor() {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const yRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onScroll() {
      yRef.current = window.scrollY || 0;
      if (raf.current == null) {
        raf.current = requestAnimationFrame(() => {
          const y = yRef.current;
          // Move layers at different speeds
          const p1 = el.querySelector<HTMLElement>('[data-layer="p1"]');
          const p2 = el.querySelector<HTMLElement>('[data-layer="p2"]');
          const s1 = el.querySelector<HTMLElement>('[data-layer="s1"]');
          if (p1) p1.style.transform = `translate3d(0, ${y * 0.06}px, 0)`;
          if (p2) p2.style.transform = `translate3d(0, ${y * 0.09}px, 0)`;
          if (s1) s1.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
          raf.current = null;
        });
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-10 overflow-visible">
      {/* Planet top-left */}
      <div data-layer="p1" className="absolute -left-10 top-[28vh] opacity-70">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="p1g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 60) rotate(120) scale(60 70)">
              <stop offset="0%" stopColor="#1C1B3A" />
              <stop offset="70%" stopColor="#0F0F22" />
              <stop offset="100%" stopColor="#0A0A18" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="58" fill="url(#p1g)" />
        </svg>
      </div>

      {/* Planet right-mid with ring */}
      <div data-layer="p2" className="absolute right-[-30px] top-[58vh] opacity-70">
        <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ring2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r="46" fill="#101022" />
          <ellipse cx="70" cy="70" rx="80" ry="18" stroke="url(#ring2)" strokeWidth="2" />
        </svg>
      </div>

      {/* Small spaceship left-bottom */}
      <div data-layer="s1" className="absolute left-[10vw] bottom-[12vh] rotate-[-8deg] opacity-80">
        <svg width="90" height="40" viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ship" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="100%" stopColor="#8A2BE2" />
            </linearGradient>
          </defs>
          <path d="M6 22 L34 12 L84 20 L34 28 Z" fill="url(#ship)" opacity="0.9" />
          <circle cx="20" cy="20" r="4" fill="#0A0A18" />
        </svg>
      </div>
    </div>
  );
}
