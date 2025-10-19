"use client";

import dynamic from "next/dynamic";

const SwapWidget = dynamic(() => import("../swap/SwapWidget"), { ssr: false });

export default function DexShell() {
  return (
    <div>
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button className="rounded bg-white/10 px-3 py-1 text-sm text-neutral-light">Swap</button>
        <span className="flex items-center gap-2 rounded px-3 py-1 text-sm text-neutral-light/60 pointer-events-none">
          Liquidity
          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Coming soon</span>
        </span>
        <span className="flex items-center gap-2 rounded px-3 py-1 text-sm text-neutral-light/60 pointer-events-none">
          Positions
          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Coming soon</span>
        </span>
      </div>

      <div className="mt-6">
        <SwapWidget />
      </div>
    </div>
  );
}
