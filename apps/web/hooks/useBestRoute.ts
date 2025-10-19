"use client";

import { useCallback, useMemo, useState } from 'react';
import { Address, createPublicClient, http, parseUnits } from 'viem';
import { bsc, bscTestnet, mainnet, polygon, arbitrum } from 'viem/chains';
import { QUOTER_V2_ABI, QUOTER_V2_ADDRESS } from '../lib/uniswap/quoterV2';
import { getV2RoutersForChain } from '../lib/routers';
import { getTokensForChain } from '../lib/tokens';
import { getEnvConfig } from '../lib/env';
import { getAmountsOut as v2GetAmountsOut } from '../lib/aggregator/adapters/V2Adapter';
import { quoterQuote as v3QuoterQuote } from '../lib/aggregator/adapters/V3Adapter';
import { algebraQuoterQuote } from '../lib/aggregator/adapters/AlgebraAdapter';

export type RouteCandidate =
  | { kind: 'UniswapV3'; fee: 500 | 3000 | 10000; amountOut: bigint }
  | { kind: 'V2'; name: string; router: Address; path: Address[]; amountOut: bigint }
  | { kind: 'Algebra'; name: string; amountOut: bigint };

export type BestRouteResult = {
  best?: RouteCandidate;
  all: RouteCandidate[];
  loading: boolean;
  error?: string;
  confidenceBps?: number;
};

// Simple in-memory TTL cache
const QUOTE_CACHE = new Map<string, { ts: number; result: BestRouteResult }>();
const TTL_MS_DEFAULT = 10_000; // 10s

export function useBestRoute(chainIdOverride?: number) {
  // Resolve chainId without relying on wagmi provider
  const chainId = chainIdOverride ?? 97;

  const chain = chainId === 97 ? bscTestnet : chainId === 56 ? bsc : chainId === 1 ? mainnet : chainId === 137 ? polygon : chainId === 42161 ? arbitrum : undefined;
  const rpcOverride = chainId === 97 ? process.env.NEXT_PUBLIC_BSC_TESTNET_RPC : undefined;
  const publicClient = useMemo(() => (chain ? createPublicClient({ chain, transport: http(rpcOverride) }) : undefined) as any, [chainId, rpcOverride, chain]);

  const [state, setState] = useState<BestRouteResult>({ loading: false, all: [] });

  const env = useMemo(() => getEnvConfig(chainId), [chainId]);
  const quoter: Address | undefined = useMemo(() => env.v3Quoter ?? QUOTER_V2_ADDRESS[chainId as number], [env.v3Quoter, chainId]);
  const tokens = useMemo(() => getTokensForChain(chainId), [chainId]);

  const quote = useCallback(
    async (
      fromSymbol: string,
      toSymbol: string,
      amountIn: string,
      opts?: { preferUniverswap?: boolean; preferUniverswapBonusBps?: number }
    ) => {
      try {
        if (!publicClient) throw new Error(`No RPC client for chain ${chainId}`);
        if (!tokens) throw new Error(`Unsupported chain ${chainId}`);
        if (!amountIn || Number(amountIn) <= 0) throw new Error('Enter an amount > 0');

        const from = tokens[fromSymbol];
        const to = tokens[toSymbol];
        if (!from) throw new Error(`From token not supported`);
        if (!to) throw new Error(`To token not supported`);

        const ttlMs = env.quoteTtlMs || TTL_MS_DEFAULT;
        const cacheKey = `${chainId}:${from.address}:${to.address}:${amountIn}`;
        const cached = QUOTE_CACHE.get(cacheKey);
        const now = Date.now();
        if (cached && now - cached.ts < (ttlMs || TTL_MS_DEFAULT)) {
          setState({ ...cached.result, loading: false });
          return;
        }

        setState({ loading: true, all: [] });

        const amountInWei = parseUnits(amountIn as `${number}` as string, from.decimals);
        const candidates: RouteCandidate[] = [];
        // Minimal liquidity safeguard: require output >= 1bps of input after normalizing decimals
        const MIN_OUTPUT_PER_INPUT_BPS = 1; // 0.01%
        const fromScale = 10n ** BigInt(from.decimals);
        const toScale = 10n ** BigInt(to.decimals);
        const passesMinRatio = (out: bigint) => (out * fromScale * 10000n) >= (amountInWei * toScale * BigInt(MIN_OUTPUT_PER_INPUT_BPS));

        // V3 Quoter (if present for chain)
        if (quoter) {
          const feeTiers: (500 | 3000 | 10000)[] = [500, 3000, 10000];
          const quotes = await v3QuoterQuote(
            publicClient as any,
            quoter,
            from.address as Address,
            to.address as Address,
            amountInWei,
            feeTiers,
            env.quoteTimeoutMs
          );
          for (const q of quotes) {
            if (passesMinRatio(q.amountOut)) candidates.push({ kind: 'UniswapV3', fee: q.fee, amountOut: q.amountOut });
          }
        }

        // Algebra (THENA CL) quoter (behind flag)
        if (env.enableAlgebra && env.algebraQuoter) {
          const quotes = await algebraQuoterQuote(
            publicClient as any,
            env.algebraQuoter,
            from.address as Address,
            to.address as Address,
            amountInWei,
            env.quoteTimeoutMs
          );
          for (const q of quotes) {
            if (passesMinRatio(q.amountOut)) candidates.push({ kind: 'Algebra', name: 'Algebra (THENA CL)', amountOut: q.amountOut });
          }
        }

        // V2 routers (multi-DEX via env + defaults), apply blacklist
        const routers = (getV2RoutersForChain(chainId) || []).filter(
          (r) => !env.routerBlacklist.some((b) => b.toLowerCase() === (r.address as Address).toLowerCase())
        );

        // Multi-hop bases (safe hubs)
        const bases = Array.from(new Set([
          tokens.WBNB?.address,
          tokens.USDT?.address,
          tokens.USDC?.address,
        ].filter(Boolean))) as Address[];

        // Path candidates: direct, 1-hop via base, 2-hop via two bases
        const pathCandidates: Address[][] = [];
        pathCandidates.push([from.address as Address, to.address as Address]);
        for (const b of bases) {
          if (b.toLowerCase() !== (from.address as Address).toLowerCase() && b.toLowerCase() !== (to.address as Address).toLowerCase()) {
            pathCandidates.push([from.address as Address, b, to.address as Address]);
          }
        }
        for (const b1 of bases) {
          for (const b2 of bases) {
            if (b1.toLowerCase() === b2.toLowerCase()) continue;
            if ([from.address, to.address].some((x) => x.toLowerCase() === b1.toLowerCase() || x.toLowerCase() === b2.toLowerCase())) continue;
            pathCandidates.push([from.address as Address, b1, b2, to.address as Address]);
          }
        }

        // Quote all router/path combos with safe fallbacks
        const routerAbi = [
          {
            name: 'getAmountsOut',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'amountIn', type: 'uint256' },
              { name: 'path', type: 'address[]' },
            ],
            outputs: [{ name: 'amounts', type: 'uint256[]' }],
          },
        ] as const;

        // Run V2 tasks in batches with concurrency limit and a global timeout (partial result fallback)
        const limit = Math.max(1, Number(env.quoteConcurrency || 6));
        const fns: (() => Promise<void>)[] = [];
        for (const r of routers) {
          for (const path of pathCandidates) {
            fns.push(async () => {
              const out = await v2GetAmountsOut(publicClient as any, r.address as Address, amountInWei, path, env.quoteTimeoutMs);
              if (out && out > 0n && passesMinRatio(out)) candidates.push({ kind: 'V2', name: r.name, router: r.address as Address, path, amountOut: out });
            });
          }
        }
        const runBatches = async () => {
          for (let i = 0; i < fns.length; i += limit) {
            const batch = fns.slice(i, i + limit);
            await Promise.all(batch.map((fn) => fn()));
          }
        };
        const globalTimeoutMs = Math.max(env.quoteTimeoutMs * 2, 2000);
        await Promise.race([
          runBatches(),
          new Promise<void>((resolve) => setTimeout(() => resolve(), globalTimeoutMs)),
        ]);

        // Pick best by net output after platform fee (default 0.2%)
        const feeBps = env.platformFeeBps ?? 20;
        const gasPenaltyBps = env.gasPenaltyBps ?? 0;
        const preferUni = opts?.preferUniverswap ?? env.preferUniverswap ?? false;
        const bonusBps = preferUni && (opts?.preferUniverswapBonusBps ?? env.preferUniverswapBonusBps) ? (opts?.preferUniverswapBonusBps ?? env.preferUniverswapBonusBps)! : 0;
        const netOut = (x: bigint) => (x * BigInt(10000 - feeBps)) / 10000n;
        const netWithPenalty = (x: bigint) => (netOut(x) * BigInt(10000 - gasPenaltyBps)) / 10000n;
        const score = (c: RouteCandidate) => {
          let base = netWithPenalty(c.amountOut);
          if (bonusBps > 0 && c.kind === 'V2' && /universwap/i.test(c.name)) {
            base = (base * BigInt(10000 + bonusBps)) / 10000n;
          }
          return base;
        };
        // Rank candidates by score (desc) to compute confidence
        const ranked = candidates.slice().sort((a, b) => (score(b) > score(a) ? 1 : score(b) < score(a) ? -1 : 0));
        const best = ranked[0];
        const second = ranked[1];
        let confidenceBps: number | undefined = undefined;
        if (best && second) {
          const sb = score(best);
          const ss = score(second);
          if (sb > 0n) {
            const gapBps = Number(((sb - ss) * 10000n) / sb);
            confidenceBps = gapBps;
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Aggregator candidates', { chainId, from: fromSymbol, to: toSymbol, count: candidates.length, best });
        }

        const result: BestRouteResult = best
          ? { loading: false, all: candidates, best, confidenceBps }
          : { loading: false, all: candidates, best: undefined, error: 'No route found for selected pair on this chain' };
        QUOTE_CACHE.set(cacheKey, { ts: Date.now(), result });
        setState(result);
      } catch (e: any) {
        const msg = e?.message || 'Route failed';
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('quote error', msg, e);
        }
        setState({ loading: false, all: [], error: msg });
      }
    },
    [publicClient, chainId, tokens, quoter]
  );

  return { quote, ...state };
}
