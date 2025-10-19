import type { Address } from 'viem';
import { getEnvConfig } from '../env';

export type ListToken = {
  chainId: number;
  address: Address;
  decimals: number;
  symbol: string;
  name?: string;
  logoURI?: string;
};

export type TokenList = {
  name: string;
  tokens: ListToken[];
};

const CACHE = new Map<string, { ts: number; tokens: Map<string, ListToken> }>();

function toChecksum(addr: string): string {
  // viem has getAddress for checksum, but keep lightweight here
  if (!addr) return addr;
  if (addr.startsWith('0x') && addr.length === 42) return addr as Address;
  return addr as Address;
}

function trustWalletLogo(addr: Address) {
  const checksum = addr as string;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${checksum}/logo.png`;
}

export async function getDynamicTokensForChain(chainId: number): Promise<Map<string, ListToken>> {
  const env = getEnvConfig(chainId);
  const key = `tokens:${chainId}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && now - cached.ts < env.quoteTtlMs) return cached.tokens;

  const merged = new Map<string, ListToken>();
  const urls = env.tokenlistUrls || [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = (await res.json()) as TokenList;
      const tokens = json?.tokens || [];
      for (const t of tokens) {
        if (t.chainId !== chainId) continue;
        const addr = toChecksum(t.address);
        if (!addr) continue;
        const keyAddr = (addr as string).toLowerCase();
        if (!merged.has(keyAddr)) {
          merged.set(keyAddr, {
            chainId,
            address: addr as Address,
            decimals: t.decimals,
            symbol: t.symbol,
            name: t.name,
            logoURI: t.logoURI || trustWalletLogo(addr as Address),
          });
        }
      }
    } catch {
      // ignore bad list
    }
  }

  CACHE.set(key, { ts: now, tokens: merged });
  return merged;
}
