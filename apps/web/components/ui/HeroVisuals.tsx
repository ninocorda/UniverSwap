"use client";
import { useEffect, useRef } from 'react';

export default function HeroVisuals() {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const latestY = useRef(0);

  useEffect(() => {
    function onScroll() {
      latestY.current = window.scrollY || 0;
      if (raf.current == null) {
        raf.current = requestAnimationFrame(() => {
          const el = ref.current;
          if (el) {
            const y = latestY.current;
            // Parallax: small translate based on scroll
            const parallax = Math.min(40, y * 0.08);
            el.style.transform = `translate3d(-50%, ${parallax}px, 0)`;
          }
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
    <div ref={ref} className="pointer-events-none absolute left-1/2 top-6 -z-10 -translate-x-1/2 opacity-60 mix-blend-screen will-change-transform">
      <svg width="1100" height="560" viewBox="0 0 1100 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Background nebula */}
          <radialGradient id="h-nebula" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(550 280) rotate(90) scale(260 480)">
            <stop offset="0%" stopColor="#6A00FF" stopOpacity="0.20" />
            <stop offset="60%" stopColor="#006EFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          {/* Planet gradient */}
          <radialGradient id="h-planet" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(660 200) rotate(120) scale(140 190)">
            <stop offset="0%" stopColor="#1C1B3A" />
            <stop offset="60%" stopColor="#0F0F20" />
            <stop offset="100%" stopColor="#0A0A18" />
          </radialGradient>
          {/* Atmospheric rim light */}
          <radialGradient id="h-rim" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(585 195) rotate(0) scale(190 150)">
            <stop offset="70%" stopColor="#00E5FF" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.35" />
          </radialGradient>
          {/* Ring gradient */}
          <linearGradient id="h-ring" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8A2BE2" stopOpacity="0.55" />
          </linearGradient>
          {/* Mask for ring behind the planet */}
          <mask id="h-planet-mask">
            <rect width="1100" height="560" fill="white" />
            <circle cx="600" cy="210" r="165" fill="black" />
          </mask>
        </defs>

        {/* Nebula background */}
        <circle cx="550" cy="280" r="260" fill="url(#h-nebula)" />

        {/* Ring behind the planet using mask */}
        <g mask="url(#h-planet-mask)">
          <ellipse cx="600" cy="210" rx="250" ry="55" stroke="url(#h-ring)" strokeWidth="6" fill="none" opacity="0.65" />
        </g>

        {/* Planet body */}
        <g filter="url(#filter0_d)">
          <circle cx="600" cy="210" r="165" fill="url(#h-planet)" />
          <circle cx="600" cy="210" r="165" fill="url(#h-rim)" />
        </g>

        {/* Ring front arc (drawn over the planet) */}
        <path d="M380 205c80-45 180-70 280-70s200 25 280 70" stroke="url(#h-ring)" strokeWidth="6" opacity="0.9" fill="none" />

        {/* Small glints around */}
        <g opacity="0.95" fill="#B4DCFF">
          <circle cx="420" cy="140" r="1.2" />
          <circle cx="820" cy="190" r="1.4" />
          <circle cx="700" cy="120" r="1.1" />
          <circle cx="520" cy="320" r="1.3" />
          <circle cx="760" cy="300" r="1.1" />
        </g>

        {/* Soft outer glow */}
        <g opacity="0.25">
          <ellipse cx="600" cy="210" rx="270" ry="70" fill="#00E5FF" />
        </g>
      </svg>
    </div>
  );
}
