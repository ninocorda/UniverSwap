# Universwap Aggregator (BSC)

This document describes the production-grade DEX aggregation architecture for Universwap on BSC (56 mainnet, 97 testnet).

## Goals
- Multi-DEX, multi-hop routing (direct, 1-base, 2-base).
- Safety first: blacklist, verified routers only, graceful fallbacks.
- Performance: TTL cache, concurrency limits, per-request timeouts, partial-result fallback.
- Extensibility: env-driven config, curated JSON, adapters for V2/V3 and external aggregators.

## Env variables
- `NEXT_PUBLIC_V2_ROUTERS_56`, `NEXT_PUBLIC_V2_ROUTERS_97`: extend routers JSON per chain.
- `NEXT_PUBLIC_V3_QUOTER_MAP_56`: quoter override for V3.
- `NEXT_PUBLIC_TOKENLIST_URLS_<chainId>`: array of tokenlist URLs.
- `NEXT_PUBLIC_ROUTER_BLACKLIST_<chainId>`: addresses to exclude.
- `NEXT_PUBLIC_QUOTE_TTL`: cache TTL seconds (default 10s).
- `NEXT_PUBLIC_QUOTE_TIMEOUT_MS`: per-call timeout (default 3000).
- `NEXT_PUBLIC_QUOTE_CONCURRENCY`: parallelism (default 6).
- `NEXT_PUBLIC_PLATFORM_FEE_BPS`: platform fee bps (default 20 = 0.2%).

## Files
- `apps/web/hooks/useBestRoute.ts`: main hook; returns `{ quote, loading, best, all, error }`.
- `apps/web/lib/routers.ts`: loads routers from static defaults + JSON + env.
- `apps/web/config/v2-routers.bsc.json`, `apps/web/config/v3-routers.bsc.json`: curated router lists (verified only).
- `apps/web/lib/env.ts`: env loader.
- `apps/web/lib/aggregator/adapters/`: V2/V3 quote adapters with timeouts.
- `apps/web/lib/tokens/ingest.ts`: tokenlist ingestion with TTL cache and logo fallback.
- `apps/web/lib/tokens/index.ts`: `getMergedTokensForChain()` for dynamic tokens with static fallback.

## Usage
- Set env variables in `.env.local`.
- Start app: `pnpm -C apps/web dev`.
- Swap UI will invoke `useBestRoute()` to fetch best route.

## Future improvements
- Liquidity checks (pair reserves).
- Gas penalty in ranking.
- External aggregator adapters (1inch/Paraswap/0x).
