"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTranslation } from '../lib/i18n/LanguageContext';

export default function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-4 backdrop-blur">
      <Link href="/" className="group flex items-center gap-4 text-neutral-light">
        <span className="relative flex h-[45px] w-[45px] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
          <Image src="/brand/images/UNIVERSWAPLOGO.png" alt="Universwap logo" fill priority className="object-contain" sizes="45px" />
        </span>
        <span className="text-2xl font-semibold tracking-tight drop-shadow-[0_0_6px_rgba(138,43,226,0.4)]">{t('header.title')}</span>
      </Link>
      <div className="flex items-center gap-6">
        <nav className="flex items-center gap-3 text-sm">
          <Link
            className="flex items-center gap-1 px-2 py-1 text-neutral-light/80 transition-colors duration-150 hover:bg-transparent hover:text-neutral-light focus-visible:outline-none"
            href="/dex"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M2 12l6-2 2-6 6 6-6 2-2 6-6-6z"/></svg>
            <span>{t('header.nav.dex')}</span>
          </Link>
          <Link
            className="flex items-center gap-1 px-2 py-1 text-neutral-light/80 transition-colors duration-150 hover:bg-transparent hover:text-neutral-light focus-visible:outline-none"
            href="/factory"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 20h18v-2l-5-3v-3l-6 3v-4l-7 4v5z"/></svg>
            <span>{t('header.nav.factory')}</span>
          </Link>
          <span
            className="flex items-center gap-2 rounded px-2 py-1 text-neutral-light/60 pointer-events-none"
            aria-disabled
          >
            <span className="flex items-center gap-1 opacity-70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
              <span>{t('header.nav.staking')}</span>
            </span>
            <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Coming soon</span>
          </span>
          <span
            className="flex items-center gap-2 rounded px-2 py-1 text-neutral-light/60 pointer-events-none"
            aria-disabled
          >
            <span className="flex items-center gap-1 opacity-70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l4 4-3 3 3 3-4 4-3-3-3 3-4-4 3-3-3-3 4-4 3 3z"/></svg>
              <span>{t('header.nav.launchpad')}</span>
            </span>
            <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Coming soon</span>
          </span>
        </nav>
        <div className="ml-2 hidden sm:block">
          {mounted && <ConnectButton chainStatus="icon" showBalance={false} />}
        </div>
      </div>
    </header>
  );
}
