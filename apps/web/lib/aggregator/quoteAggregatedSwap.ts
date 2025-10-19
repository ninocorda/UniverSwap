import type { Address, PublicClient } from 'viem';

import { getPublicClient } from '../viemClient';
import { getEnvConfig, type V2RouterConfig } from '../env';
import V2_BSC from '../../config/v2-routers.bsc.json';

import { buildCandidatePaths, type CandidateRoute } from './buildCandidatePaths';
import { quoteRoute, type QuoteMode, type QuoteRouteResult, type RouterConfig } from './quoteRoute';
import { selectBestQuote } from './selectBestQuote';

const CACHE_TTL_MS = 30_000;
const AMOUNT_VARIANCE_BPS = 500n; // 5%

export type BestQuote = QuoteRouteResult;

export interface QuoteAggregatedSwapParams {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  /** Amount provided in smallest units. For exact-in, represents amountIn; for exact-out, target amountOut. */
  amount: bigint;
  mode: QuoteMode;
  routesPool?: (Address | string)[];
  maxRoutes?: number;
  timeoutMs?: number;
}

interface CachedQuote {
  timestamp: number;
  mode: QuoteMode;
  amount: bigint;
  quote: QuoteRouteResult;
}

const cache = new Map<string, CachedQuote>();

function fallbackV2Routers(chainId: number): V2RouterConfig[] {
  if (chainId !== 56 && chainId !== 97) return [];
  const list = (V2_BSC as any as { name: string; address?: string; testnetAddress?: string | null }[])
    .map((entry) => ({
      name: entry.name,
      address: (chainId === 97 ? entry.testnetAddress : entry.address) as Address,
    }))
    .filter((entry) => entry.address && entry.address.length > 0) as V2RouterConfig[];
  return list;
}

function loadRouters(chainId: number): RouterConfig[] {
  const env = getEnvConfig(chainId);
  let routers = env.v2Routers;
  if (!routers || routers.length === 0) routers = fallbackV2Routers(chainId);
  if (!routers || routers.length === 0) return [];

  const blacklist = new Set((env.routerBlacklist || []).map((a) => (a as string).toLowerCase()));
  return routers
    .filter((router) => router.address)
    .map((router) => ({ name: router.name, address: router.address as Address }))
    .filter((router) => !blacklist.has(router.address.toLowerCase()));
}

function cacheKey(params: { chainId: number; router: RouterConfig; tokenIn: Address; tokenOut: Address; mode: QuoteMode }): string {
  return [
    params.chainId,
    params.router.address.toLowerCase(),
    params.tokenIn.toLowerCase(),
    params.tokenOut.toLowerCase(),
    params.mode,
  ].join('::');
}

function isCacheValid(entry: CachedQuote, amount: bigint): boolean {
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return false;
  if (entry.amount === 0n) return amount === 0n;
  const diff = entry.amount > amount ? entry.amount - amount : amount - entry.amount;
  return diff * 10_000n <= entry.amount * AMOUNT_VARIANCE_BPS;
}

function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let current = 0;
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (true) {
      const idx = current++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  });
  return Promise.all(workers).then(() => results);
}

export async function quoteAggregatedSwap(params: QuoteAggregatedSwapParams): Promise<BestQuote> {
  const { chainId, tokenIn, tokenOut, amount, mode, routesPool, maxRoutes, timeoutMs } = params;

  if (amount <= 0n) throw new Error('Amount must be greater than zero');
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) throw new Error('tokenIn and tokenOut must differ');

  const routers = loadRouters(chainId);
  if (routers.length === 0) throw new Error('No routers configured for this chain');

  const candidateRoutes: CandidateRoute[] = buildCandidatePaths({
    chainId,
    tokenIn,
    tokenOut,
    routesPool,
    maxRoutes,
  });
  if (candidateRoutes.length === 0) throw new Error('No candidate paths available');

  const client: PublicClient = getPublicClient(chainId);
  const env = getEnvConfig(chainId);
  const concurrency = Math.max(1, Number(env.quoteConcurrency || 6));

  const routerQuotes: QuoteRouteResult[] = [];

  await mapWithConcurrency(routers, concurrency, async (router) => {
    const key = cacheKey({ chainId, router, tokenIn, tokenOut, mode });
    const cached = cache.get(key);
    if (cached && cached.mode === mode && isCacheValid(cached, amount)) {
      routerQuotes.push(cached.quote);
      return;
    }

    const quotes: QuoteRouteResult[] = [];
    for (const candidate of candidateRoutes) {
      const result = await quoteRoute({
        client,
        router,
        path: candidate.path,
        amount,
        mode,
        timeoutMs: timeoutMs ?? env.quoteTimeoutMs,
      });
      if (!result) continue;

      console.debug('[quote]', {
        router: router.name,
        path: candidate.labels || candidate.path,
        mode,
        amountIn: result.amountIn.toString(),
        amountOut: result.amountOut.toString(),
        forwardPrice: result.forwardPrice,
        reversePrice: result.reversePrice,
        spreadBps: result.spreadBps,
      });

      quotes.push(result);
    }

    const bestForRouter = selectBestQuote(quotes, mode);
    if (bestForRouter) {
      cache.set(key, {
        timestamp: Date.now(),
        mode,
        amount,
        quote: bestForRouter,
      });
      routerQuotes.push(bestForRouter);
    } else {
      cache.delete(key);
    }
  });

  const best = selectBestQuote(routerQuotes, mode);
  if (!best) {
    throw new Error('No viable quotes found');
  }
  return best;
}
