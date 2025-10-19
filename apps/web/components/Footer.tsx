"use client";
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/10 py-6 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-light/70 md:flex-row">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image src="/brand/images/UNIVERSWAPLOGO.png" alt="Universwap logo" fill className="object-cover" sizes="40px" />
          </span>
          <span className="text-base font-medium text-neutral-light/80">Universwap © {new Date().getFullYear()}</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link className="btn-space rounded px-2 py-1 hover:bg-white/5" href="https://twitter.com/universwap" target="_blank" rel="noreferrer">
            <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.8c-.7.3-1.4.5-2.2.6.8-.5 1.4-1.2 1.7-2-.8.5-1.6.9-2.5 1.1A3.8 3.8 0 0 0 12 7.8c0 .3 0 .5.1.8A10.8 10.8 0 0 1 3 5.2a3.8 3.8 0 0 0 1.2 5 3.8 3.8 0 0 1-1.7-.5v.1c0 1.9 1.3 3.5 3.1 3.9-.3.1-.7.2-1 .2-.3 0-.5 0-.8-.1a3.8 3.8 0 0 0 3.6 2.7A7.6 7.6 0 0 1 2 19.6a10.8 10.8 0 0 0 5.8 1.7c7 0 10.9-5.8 10.9-10.9v-.5c.8-.5 1.5-1.2 2.1-2.1z"/></svg>Twitter</span>
          </Link>
          <Link className="btn-space rounded px-2 py-1 hover:bg-white/5" href="https://discord.gg/q5u3ZypRcW" target="_blank" rel="noreferrer">
            <span className="inline-flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6a16 16 0 0 0-4-1l-.3.6A13 13 0 0 1 8.3 5L8 4.9a16 16 0 0 0-4 1A11 11 0 0 0 2 18c2 2 5 2.6 5 2.6l.7-1.2a8 8 0 0 1-1.3-.6l.2-.2A10 10 0 0 0 8 19.3c2 .9 4 .9 6 0 .3.1.7.4.7.4-.4.2-.8.5-1.3.6L14 20.6S20 20 22 18a11 11 0 0 0-2-12zM9.8 15c-.8 0-1.4-.7-1.4-1.5S9 12 9.8 12c.7 0 1.4.7 1.4 1.5S10.6 15 9.8 15zm4.5 0c-.8 0-1.4-.7-1.4-1.5s.6-1.5 1.4-1.5c.7 0 1.4.7 1.4 1.5S15 15 14.3 15z"/></svg>Discord</span>
          </Link>
        </nav>
      </div>
    </footer>
  );
}
