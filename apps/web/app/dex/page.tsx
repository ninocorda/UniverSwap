export const metadata = {
  title: 'DEX',
  description: 'Swap tokens and manage concentrated liquidity (Uniswap V3 integration).',
};

export default function DexPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-light">DEX</h1>
      <p className="mt-2 text-neutral-light/80">
        Fast swaps with native BNB support. Coming soon: liquidity (V3), positions, and advanced routing.
      </p>
      <div className="mt-8">
        <DexShell />
      </div>
    </main>
  );
}

// Client component import
import dynamic from 'next/dynamic';
const DexShell = dynamic(() => import('../../components/dex/DexShell'), { ssr: false });
