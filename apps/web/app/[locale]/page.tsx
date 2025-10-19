import Link from 'next/link';

export default function HomeLocale() {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-space-gradient" />
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-neutral-light md:text-7xl">
          Universo financiero futurista
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-light/80">
          Swaps multichain, Liquidez Concentrada (CL), Token Factory y Staking, todo impulsado por una interfaz galáctica.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/dex"
            className="btn-space inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-neutral-light shadow hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M2 12l6-2 2-6 6 6-2 6-6 2-6-6z"/></svg>
            Launch App
          </Link>
          <Link
            href="/docs"
            className="btn-space inline-flex items-center gap-2 rounded-md border border-secondary/50 px-5 py-2.5 text-neutral-light hover:bg-secondary/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 4h16v2H4zm0 6h16v2H4zm0 6h10v2H4z"/></svg>
            Documentation
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <Feature
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l6-2 2-6 6 6-6 2-2 6-6-6z"/></svg>}
            title="DEX"
            desc="Rutas V2/V3/Algebra (CL) con agregación y slippage controlado."
          />
          <Feature
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20h18v-2l-5-3v-3l-6 3v-4l-7 4v5z"/></svg>}
            title="Token Factory"
            desc="Crea tokens ERC20 con opciones avanzadas de gobernanza."
          />
          <Feature
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>}
            title="Liquidity & Staking"
            desc="Provee liquidez y farmea recompensas con contratos auditados."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="btn-space rounded-lg border border-neutral-light/10 bg-white/5 p-5 text-left backdrop-blur">
      <div className="flex items-center gap-2 text-neutral-light">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 text-primary">{icon}</span>
        <div className="text-lg font-medium">{title}</div>
      </div>
      <div className="mt-2 text-sm text-neutral-light/80">{desc}</div>
    </div>
  );
}
