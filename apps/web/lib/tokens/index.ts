import { MAINNET_TOKENS } from './mainnet';
import { POLYGON_TOKENS } from './polygon';
import { ARBITRUM_TOKENS } from './arbitrum';
import { BSC_TOKENS } from './bsc';
import { BSC_TESTNET_TOKENS } from './bscTestnet';
import type { Address } from 'viem';
import { getDynamicTokensForChain } from './ingest';

export type TokenMap = typeof MAINNET_TOKENS;

export function getTokensForChain(chainId: number): TokenMap | undefined {
  switch (chainId) {
    case 1:
      return MAINNET_TOKENS;
    case 137:
      return POLYGON_TOKENS as unknown as TokenMap;
    case 42161:
      return ARBITRUM_TOKENS as unknown as TokenMap;
    case 56:
      return BSC_TOKENS as unknown as TokenMap;
    case 97:
      return BSC_TESTNET_TOKENS as unknown as TokenMap;
    default:
      return undefined;
  }
}

// Dynamic token catalog using env-provided tokenlists, merged with static tokens as fallback.
// Returns a map keyed by lowercase address string.
export async function getMergedTokensForChain(
  chainId: number
): Promise<Map<string, { address: Address; decimals: number; symbol: string; name?: string; logoURI?: string }>> {
  const dynamic = await getDynamicTokensForChain(chainId);
  if (dynamic.size > 0) return dynamic;

  const statics = getTokensForChain(chainId);
  const merged = new Map<string, { address: Address; decimals: number; symbol: string; name?: string; logoURI?: string }>();
  if (statics) {
    const entries = Object.entries(statics as Record<string, any>) as [string, any][];
    for (const [sym, tAny] of entries) {
      const addr = tAny?.address as Address | undefined;
      if (!addr) continue;
      const key = (addr as string).toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, {
          address: addr,
          decimals: (tAny?.decimals as number) ?? 18,
          symbol: (tAny?.symbol as string) || sym,
          name: tAny?.name as string | undefined,
          logoURI: tAny?.logoURI as string | undefined,
        });
      }
    }
  }
  return merged;
}

// Convert a merged token map (keyed by lowercase address) to a TokenMap-like object keyed by symbol.
export function toTokenMapFromMerged(merged: Map<string, { address: Address; decimals: number; symbol: string; name?: string; logoURI?: string }>): TokenMap {
  const result: any = {};
  for (const [, t] of merged) {
    // Prefer first occurrence of a symbol
    if (!result[t.symbol]) {
      result[t.symbol] = {
        address: t.address,
        decimals: t.decimals,
        symbol: t.symbol,
        name: t.name,
        logoURI: t.logoURI,
      };
    }
  }
  return result as TokenMap;
}

// Convenience: prefer dynamic tokenlists but fall back to static TokenMap shape
export async function getPreferDynamicTokenMap(chainId: number): Promise<TokenMap | undefined> {
  const merged = await getMergedTokensForChain(chainId);
  if (merged.size > 0) return toTokenMapFromMerged(merged);
  return getTokensForChain(chainId);
}
