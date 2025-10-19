export const metadata = {
  title: 'Token Factory',
  description: 'Generate ERC20 tokens using OpenZeppelin + Clone Factory.',
};

import Link from 'next/link';
import dynamic from 'next/dynamic';
const FactoryClient = dynamic(() => import('./FactoryClient'), { ssr: false });

export default function FactoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-light">Token Factory</h1>
          <p className="mt-2 text-neutral-light/80">
            Create ERC20 tokens via minimal proxy clones. Set name, symbol, and decimals.
          </p>
        </div>
        <Link
          href="/factory/tokens"
          className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-neutral-dark transition hover:bg-primary/90"
        >
          View deployed tokens
        </Link>
      </header>
      <FactoryClient />
    </main>
  );
}
