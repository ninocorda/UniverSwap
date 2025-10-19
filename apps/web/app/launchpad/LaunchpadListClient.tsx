'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Address, formatUnits } from 'viem';
import { useChainId, usePublicClient } from 'wagmi';
import { IDOFactoryABI } from '../../lib/abi/IDOFactory';
import { IDOPoolABI } from '../../lib/abi/IDOPool';
import { ERC20ABI } from '../../lib/abi/ERC20';
import { getIdoFactoryForChain } from '../../lib/config';
import { getTokenInfo } from '../../lib/tokens';

export default function LaunchpadListClient() {
  const chainIdRaw = useChainId();
  const chainId = chainIdRaw || 97;
  const factoryPrimary = useMemo(() => getIdoFactoryForChain(chainId), [chainId]);
  const effectiveChainId = factoryPrimary ? chainId : 97;
  const factory = useMemo(() => factoryPrimary || getIdoFactoryForChain(97), [factoryPrimary]);
  const publicClient = usePublicClient({ chainId: effectiveChainId } as any);
  const explorerBase = effectiveChainId === 97 ? 'https://testnet.bscscan.com' : effectiveChainId === 56 ? 'https://bscscan.com' : '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pools, setPools] = useState<Address[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(undefined);
        setPools([]);
        if (!publicClient) throw new Error('No public RPC client');
        if (!factory) throw new Error(`IDOFactory address missing for chain ${effectiveChainId}`);
        const res = (await publicClient.readContract({
          abi: IDOFactoryABI as any,
          address: factory as Address,
          functionName: 'getAllPools',
          args: [],
        })) as Address[];
        if (mounted) setPools(res);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load pools');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [factory, publicClient, effectiveChainId]);

  // Load metadata for each pool
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!publicClient) return;
        const out: any[] = [];
        for (const p of pools) {
          try {
            const [sale, raise, soft, hard, raised, stat, wl] = await Promise.all([
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'saleToken' }) as Promise<Address>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'raiseToken' }) as Promise<Address>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'softCap' }) as Promise<bigint>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'hardCap' }) as Promise<bigint>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'totalRaised' }) as Promise<bigint>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'status' }) as Promise<number>,
              publicClient.readContract({ abi: IDOPoolABI as any, address: p, functionName: 'whitelistEnabled', args: [] }) as Promise<boolean>,
            ]);
            let raiseDecimals = 18;
            let saleSymbol = 'SALE';
            let raiseSymbol = 'RAISE';
            try {
              if (raise !== '0x0000000000000000000000000000000000000000') {
                const [rdec, rsym] = await Promise.all([
                  publicClient.readContract({ abi: ERC20ABI as any, address: raise, functionName: 'decimals' }) as Promise<number>,
                  publicClient.readContract({ abi: ERC20ABI as any, address: raise, functionName: 'symbol' }) as Promise<string>,
                ]);
                raiseDecimals = rdec || 18;
                raiseSymbol = rsym || raiseSymbol;
              } else {
                raiseSymbol = 'BNB';
              }
              const ssym = await publicClient.readContract({ abi: ERC20ABI as any, address: sale, functionName: 'symbol' }) as string;
              if (ssym) saleSymbol = ssym;
            } catch {}
            const progress = hard > 0n ? Number(raised) / Number(hard) : 0;
            out.push({
              address: p,
              sale,
              raise,
              saleSymbol,
              raiseSymbol,
              soft,
              hard,
              raised,
              raiseDecimals,
              status: stat,
              progress,
              whitelistEnabled: wl,
            });
          } catch {
            // ignore broken pool
          }
        }
        if (mounted) setItems(out);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient, pools]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-light">Launchpad</h1>
        <Link href="/launchpad/create" className="rounded bg-primary px-3 py-2 text-neutral-dark hover:opacity-90">Create Pool</Link>
      </div>
      {!factoryPrimary && (
        <div className="mb-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          Using BSC Testnet (97) factory by default. Set NEXT_PUBLIC_IDO_FACTORY_{chainId} to use your current network.
        </div>
      )}
      {loading && (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-neutral-light/10 bg-white/5 p-4">
              <div className="mb-2 h-4 w-40 rounded bg-white/10" />
              <div className="mb-3 h-3 w-64 rounded bg-white/10" />
              <div className="h-2 w-full rounded bg-white/10" />
              <div className="mt-2 h-3 w-60 rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}
      {error && <div className="text-accent text-sm">{error}</div>}
      <div className="grid gap-3">
        {pools.length === 0 && !loading && !error && (
          <div className="text-neutral-light/60">No pools found.</div>
        )}
        {items.map((it) => (
          <Link key={it.address} href={`/launchpad/${it.address}`} className="rounded-lg border border-neutral-light/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="mb-1 flex items-center gap-2 text-neutral-light font-medium truncate">
              {(() => { const info = getTokenInfo(effectiveChainId, it.sale); return info?.logo ? <img alt={info.symbol} src={info.logo} className="h-4 w-4 rounded-full" /> : null; })()}
              <span>{it.saleSymbol}</span>
              <span className="opacity-60">/</span>
              {(() => { const info = getTokenInfo(effectiveChainId, it.raise); return info?.logo ? <img alt={info.symbol} src={info.logo} className="h-4 w-4 rounded-full" /> : null; })()}
              <span>{it.raiseSymbol}</span>
              {it.whitelistEnabled && <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] text-neutral-light/80">Whitelist</span>}
            </div>
            <div className="text-xs text-neutral-light/60 truncate">
              <span className="opacity-80">Pool:</span> <span className="underline">{it.address}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-neutral-light/60">
              <div className="truncate">
                <span className="opacity-70">Sale:</span> {explorerBase ? <a className="underline" href={`${explorerBase}/address/${it.sale}`} target="_blank" rel="noreferrer">{it.sale}</a> : it.sale}
              </div>
              <div className="truncate">
                <span className="opacity-70">Raise:</span> {it.raise === '0x0000000000000000000000000000000000000000' ? 'BNB' : (explorerBase ? <a className="underline" href={`${explorerBase}/address/${it.raise}`} target="_blank" rel="noreferrer">{it.raise}</a> : it.raise)}
              </div>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-white/10">
              <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, Math.max(0, it.progress * 100)).toFixed(1)}%` }} />
            </div>
            <div className="mt-2 text-xs text-neutral-light/70">
              Raised {formatUnits(it.raised, it.raiseDecimals)} / {formatUnits(it.hard, it.raiseDecimals)} {it.raiseSymbol}
            </div>
            <div className="text-xs text-neutral-light/50">Status: {it.status === 0 ? 'Pending' : it.status === 1 ? 'Active' : it.status === 2 ? 'Finalized (Success)' : 'Finalized (Fail)'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
