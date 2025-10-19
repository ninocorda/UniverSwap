import Link from 'next/link';
import { BackedByStrip } from '../components/BackedByStrip';

const WHY_POINTS = [
  {
    title: 'Mission-Control UX',
    description:
      'Dynamic dashboards, live quotes, and tactile micro-interactions make trading feel like piloting a starship—without sacrificing clarity for newcomers.',
  },
  {
    title: 'Algebra-Powered CL',
    description:
      'Deploy concentrated liquidity positions on BSC with Algebra math under the hood, so every tick of your range works harder for LP rewards.',
  },
  {
    title: 'Strategic Fee Engine',
    description:
      'Dial slippage, routing sensitivity, and gas preferences per trade, letting advanced operators execute with surgical precision.',
  },
  {
    title: 'Multichain Flight Plan',
    description:
      'Universwap bridges leading ecosystems—BNB Chain, Ethereum, Arbitrum, Optimism, and more—so expansion is a configuration, not a rebuild.',
  },
];

export default function Home() {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden">
      <section className="relative mx-auto max-w-6xl px-6 py-0 text-center">
        <h1 className="mt-20 text-5xl font-semibold tracking-tight text-neutral-light md:text-7xl">
          A Futuristic Financial Universe
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-light/80">
          Multichain swaps, Concentrated Liquidity (CL), Token Factory, and Staking — delivered through a sleek galactic UI.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/dex"
            className="btn-space inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-neutral-light shadow transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none"
          >
            Launch App
          </Link>
          <Link
            href="/docs"
            className="btn-space inline-flex items-center gap-2 rounded-md border border-secondary/50 px-5 py-2.5 text-neutral-light hover:bg-secondary/10"
          >
            Documentation
          </Link>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <Stat label="Chains" value="7+" badge="Coming soon" />
          <Stat label="DEX Sources" value="V2 / V3 / CL" />
          <Stat label="Routing" value="Best Path" />
          <Stat label="Slippage" value="Configurable" />
        </div>
      </section>

      <div className="mt-0 w-screen max-w-none overflow-hidden px-0">
        <BackedByStrip />
      </div>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <Feature
            title="DEX"
            desc="Aggregated routes across V2, V3 & Algebra (CL) with controlled slippage."
          />
          <Feature
            title="Token Factory"
            desc="Create ERC20 tokens with advanced options and governance-ready presets."
          />
          <Feature
            title="Liquidity & Staking"
            desc="Provide liquidity and farm rewards through audited contracts."
          />
        </div>

        {/* Secondary section */}
        <div className="mx-auto mt-16 max-w-5xl rounded-xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur">
          <h2 className="text-xl font-semibold text-neutral-light">Why Universwap?</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {WHY_POINTS.map((point) => (
              <div key={point.title} className="btn-space rounded-md bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">{point.title}</div>
                <p className="mt-2 text-sm text-neutral-light/80">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="btn-space rounded-lg border border-neutral-light/10 bg-white/5 p-5 text-left backdrop-blur">
      <div className="text-lg font-medium text-neutral-light">{title}</div>
      <div className="mt-2 text-sm text-neutral-light/80">{desc}</div>
    </div>
  );
}

function Stat({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="relative rounded-md border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur">
      {badge && (
        <span className="absolute top-1.5 right-2 rounded-full border border-secondary/40 bg-secondary/20 px-2 py-[1px] text-[8px] font-semibold uppercase tracking-[0.18em] text-secondary">
          {badge}
        </span>
      )}
      <div className="text-lg font-semibold text-neutral-light">{value}</div>
      <div className="text-xs text-neutral-light/70">{label}</div>
    </div>
  );
}
