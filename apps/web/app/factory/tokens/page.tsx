export const metadata = {
  title: 'My Tokens | Token Factory',
  description: 'Manage tokens deployed via the Universwap TokenFactory.',
};

import dynamic from 'next/dynamic';

const TokensClient = dynamic(() => import('./TokensClient'), { ssr: false });

export default function FactoryTokensPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-light">Token Factory · My Tokens</h1>
      <p className="mt-2 text-neutral-light/80">
        Browse every token you created, grab verification details, and execute management actions without leaving the dashboard.
      </p>
      <TokensClient />
    </main>
  );
}
