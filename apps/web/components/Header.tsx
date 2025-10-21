"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTranslation } from '../lib/i18n/LanguageContext';

type NavLayout = 'desktop' | 'mobile';

function NavigationItems({ layout, onNavigate }: { layout: NavLayout; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const linkClasses = clsx(
    'flex items-center gap-1 px-2 py-1 text-neutral-light/80 transition-colors duration-150 hover:text-neutral-light focus-visible:outline-none',
    layout === 'mobile' && 'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-base text-neutral-light'
  );
  const disabledClasses = clsx(
    'flex items-center gap-2 rounded px-2 py-1 text-neutral-light/60 pointer-events-none',
    layout === 'mobile' && 'border border-dashed border-white/10 px-3 py-2 text-base'
  );

  const navClassName = clsx(
    'text-sm',
    layout === 'desktop' && 'hidden items-center justify-end gap-3 lg:flex',
    layout === 'mobile' && 'flex flex-col items-end gap-3 text-right'
  );

  return (
    <nav className={navClassName}>
      <Link className={linkClasses} href="/dex" onClick={onNavigate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M2 12l6-2 2-6 6 6-6 2-2 6-6-6z" />
        </svg>
        <span>{t('header.nav.dex')}</span>
      </Link>
      <Link className={linkClasses} href="/factory" onClick={onNavigate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 20h18v-2l-5-3v-3l-6 3v-4l-7 4v5z" />
        </svg>
        <span>{t('header.nav.factory')}</span>
      </Link>
      <span className={disabledClasses} aria-disabled>
        <span className="flex items-center gap-1 opacity-70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <span>{t('header.nav.staking')}</span>
        </span>
        <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          Coming soon
        </span>
      </span>
      <span className={disabledClasses} aria-disabled>
        <span className="flex items-center gap-1 opacity-70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l4 4-3 3 3 3-4 4-3-3-3 3-4-4 3-3-3-3 4-4 3 3z" />
          </svg>
          <span>{t('header.nav.launchpad')}</span>
        </span>
        <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          Coming soon
        </span>
      </span>
    </nav>
  );
}

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMounted(true), []);
  useEffect(() => setIsMenuOpen(false), [pathname]);
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-4 backdrop-blur lg:relative">
      <Link href="/" className="group flex items-center gap-4 text-neutral-light">
        <span className="relative flex h-[45px] w-[45px] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
          <Image src="/brand/images/UNIVERSWAPLOGO.png" alt="Universwap logo" fill priority className="object-contain" sizes="45px" />
        </span>
        <span className="text-2xl font-semibold tracking-tight drop-shadow-[0_0_6px_rgba(138,43,226,0.4)]">{t('header.title')}</span>
      </Link>
      <div className="flex flex-1 items-center justify-end gap-6">
        <NavigationItems layout="desktop" />
        <div className="ml-2 hidden lg:flex lg:justify-end">
          {mounted && <ConnectButton chainStatus="icon" showBalance={false} />}
        </div>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="relative z-50 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded border border-white/10 bg-black/30 text-neutral-light transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 lg:hidden"
        >
          <span
            className={clsx(
              'block h-0.5 w-5 bg-current transition-transform duration-200 ease-in-out',
              isMenuOpen ? 'translate-y-1.5 rotate-45' : '-translate-y-1.5'
            )}
          />
          <span
            className={clsx(
              'block h-0.5 w-5 bg-current transition-opacity duration-200 ease-in-out',
              isMenuOpen ? 'opacity-0' : 'opacity-100'
            )}
          />
          <span
            className={clsx(
              'block h-0.5 w-5 bg-current transition-transform duration-200 ease-in-out',
              isMenuOpen ? '-translate-y-1.5 -rotate-45' : 'translate-y-1.5'
            )}
          />
        </button>
      </div>
      <div
        className={clsx(
          'absolute left-0 right-0 top-full origin-top border-b border-white/10 bg-black/90 backdrop-blur-lg transition-all duration-200 lg:hidden',
          isMenuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        )}
        aria-hidden={!isMenuOpen}
      >
        <div className="flex flex-col items-end gap-4 px-6 py-5 text-right">
          <NavigationItems layout="mobile" onNavigate={() => setIsMenuOpen(false)} />
          <div className="w-full border-t border-white/10 pt-4 flex justify-end">
            {mounted && <ConnectButton chainStatus="icon" showBalance={false} />}
          </div>
        </div>
      </div>
    </header>
  );
}
