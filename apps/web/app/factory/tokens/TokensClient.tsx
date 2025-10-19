'use client';

import { useEffect, useMemo, useState } from 'react';
import { Address, isAddress } from 'viem';
import { useAccount, useChainId } from 'wagmi';
import Link from 'next/link';
import { useFactoryTokens } from '../../../hooks/useFactoryTokens';
import { getTokenFactoryForChain } from '../../../lib/config';
import { useToast } from '../../../components/ui/Toast';
import TokenCard from './components/TokenCard';

export default function TokensClient() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const chainFactory = useMemo(() => getTokenFactoryForChain(chainId), [chainId]);
  const effectiveFactory = chainFactory && isAddress(chainFactory) ? (chainFactory as Address) : undefined;
  const { data, isFetching, error, refetch, isRefetching } = useFactoryTokens(effectiveFactory);
  const { addToast } = useToast();
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const toggleToken = (address: string) => {
    setExpandedToken((current) => (current === address ? null : address));
  };

  useEffect(() => {
    if (error) {
      addToast({
        kind: 'error',
        title: 'Error fetching tokens',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [error, addToast]);

  return (
    <div className="mt-10 grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-neutral-light">My Tokens</h2>
        <p className="text-sm text-neutral-light/70">
          Review every token you deployed via TokenFactory. Inspect verification data and call management functions directly.
        </p>
      </header>

      {!effectiveFactory && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          TokenFactory address not configured for chain {chainId}. Configure `NEXT_PUBLIC_TOKEN_FACTORY_{chainId}` or contact support.
          <div className="mt-2 text-xs text-red-100/80">
            Need to deploy a new factory?{' '}
            <Link href="/factory" className="text-primary hover:underline">
              Open the TokenFactory wizard
            </Link>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="rounded border border-yellow-400/40 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          Connect your wallet to load your tokens.
        </div>
      )}

      {isConnected && effectiveFactory && (isFetching || isRefetching) && (
        <div className="rounded border border-neutral-light/10 bg-neutral-dark/40 p-4 text-sm text-neutral-light/70">
          Loading tokens from chain {chainId}…
        </div>
      )}

      {isConnected && effectiveFactory && !isFetching && data && data.length === 0 && (
        <div className="rounded border border-neutral-light/10 bg-neutral-dark/40 p-4 text-sm text-neutral-light/70">
          No tokens found for your wallet on this factory.
        </div>
      )}

      <div className="grid gap-4">
        {data?.map((token) => {
          const isExpanded = expandedToken === token.address;
          return (
            <section key={token.address} className="rounded-xl border border-neutral-light/15 bg-neutral-dark/50">
              <button
                type="button"
                onClick={() => toggleToken(token.address)}
                className="flex w-full items-center justify-between gap-3 rounded-t-xl bg-white/5 px-4 py-3 text-left text-sm text-neutral-light hover:bg-white/10"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-neutral-light">{token.name}</span>
                  <span className="text-xs text-neutral-light/60">
                    {token.symbol} · {token.totalSupply} minted · Created {new Date(token.record.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-lg text-primary">{isExpanded ? '−' : '+'}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1">
                  <TokenCard
                    token={token}
                    chainId={chainId}
                    factoryAddress={effectiveFactory}
                    onRefresh={() => {
                      refetch();
                    }}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
