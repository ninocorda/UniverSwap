import type { Address } from 'viem';
import V3_BSC from '../config/v3-routers.bsc.json';

export type V2RouterConfig = { name: string; address: Address; priority?: number };
export type QuoterMap = { chainId: number; quoter: Address };

export type AggregatorEnv = {
  v2Routers: V2RouterConfig[];
  v3Quoter?: Address;
  algebraQuoter?: Address;
  algebraRouter?: Address;
  tokenlistUrls: string[];
  routerBlacklist: Address[];
  quoteTtlMs: number;
  quoteTimeoutMs: number;
  quoteConcurrency: number;
  platformFeeBps: number;
  gasPenaltyBps?: number;
  preferUniverswap?: boolean;
  preferUniverswapBonusBps?: number;
  enableAlgebra?: boolean;
};

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getEnvConfig(chainId: number): AggregatorEnv {
  const routersEnv = (process.env[`NEXT_PUBLIC_V2_ROUTERS_${chainId}` as any] as string | undefined) || '[]';
  const v2Routers = parseJson<V2RouterConfig[]>(routersEnv, []).filter(
    (r) => r && typeof r.name === 'string' && typeof r.address === 'string'
  ) as V2RouterConfig[];

  let v3Quoter: Address | undefined;
  if (chainId === 56) {
    const map = parseJson<QuoterMap>(process.env.NEXT_PUBLIC_V3_QUOTER_MAP_56, undefined as any);
    v3Quoter = map?.quoter as Address | undefined;
  }
  // Fallback to curated JSON if env absent
  if (!v3Quoter && (chainId === 56 || chainId === 97)) {
    try {
      const list = V3_BSC as any as { name: string; quoter?: Address; testnetQuoter?: Address | null }[];
      const entry = list.find((e) => e.quoter || e.testnetQuoter);
      const addr = chainId === 97 ? (entry?.testnetQuoter as Address | undefined) : (entry?.quoter as Address | undefined);
      if (addr) v3Quoter = addr;
    } catch {}
  }

  const tokenlistUrls = parseJson<string[]>(process.env[`NEXT_PUBLIC_TOKENLIST_URLS_${chainId}` as any], []);
  const routerBlacklist = parseJson<Address[]>(process.env[`NEXT_PUBLIC_ROUTER_BLACKLIST_${chainId}` as any], []);

  const quoteTtlSec = Number(process.env.NEXT_PUBLIC_QUOTE_TTL || 10);
  const quoteTtlMs = quoteTtlSec * 1000;
  const quoteTimeoutMs = Number(process.env.NEXT_PUBLIC_QUOTE_TIMEOUT_MS || 3000);
  const quoteConcurrency = Number(process.env.NEXT_PUBLIC_QUOTE_CONCURRENCY || 6);
  const platformFeeBps = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS || 20);
  const gasPenaltyBps = process.env.NEXT_PUBLIC_GAS_PENALTY_BPS ? Number(process.env.NEXT_PUBLIC_GAS_PENALTY_BPS) : undefined;
  const preferUniverswap = String(process.env.NEXT_PUBLIC_PREFER_UNIVERSWAP || '').toLowerCase() === 'true';
  const preferUniverswapBonusBps = process.env.NEXT_PUBLIC_PREFER_UNIVERSWAP_BONUS_BPS ? Number(process.env.NEXT_PUBLIC_PREFER_UNIVERSWAP_BONUS_BPS) : undefined;

  const algebraQuoter = process.env[`NEXT_PUBLIC_ALGEBRA_QUOTER_${chainId}` as any] as Address | undefined;
  const algebraRouter = process.env[`NEXT_PUBLIC_ALGEBRA_ROUTER_${chainId}` as any] as Address | undefined;
  const enableAlgebra = String(process.env.NEXT_PUBLIC_ENABLE_ALGEBRA || '').toLowerCase() === 'true';

  return {
    v2Routers,
    v3Quoter,
    algebraQuoter,
    algebraRouter,
    tokenlistUrls,
    routerBlacklist,
    quoteTtlMs,
    quoteTimeoutMs,
    quoteConcurrency,
    platformFeeBps,
    gasPenaltyBps,
    preferUniverswap,
    preferUniverswapBonusBps,
    enableAlgebra,
  };
}
