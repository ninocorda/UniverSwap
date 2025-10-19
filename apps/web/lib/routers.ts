import type { Address } from 'viem';
// Statically import curated BSC router config to allow Next.js bundling
import V2_BSC from '../config/v2-routers.bsc.json';

// Known public V2-like router addresses per chain (partial list)
export const V2_ROUTERS: Record<number, { name: string; address: Address }[]> = {
  // Ethereum mainnet
  1: [
    { name: 'UniswapV2', address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
    { name: 'SushiSwap', address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F' },
  ],
  // Polygon
  137: [
    { name: 'SushiSwap', address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
    { name: 'QuickSwap', address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' },
  ],
  // Arbitrum One
  // BSC
  56: [
    { name: 'PancakeSwap', address: '0x10ED43C718714eb63d5aA57B78B54704E256024E' },
  ],
  // BSC Testnet
  97: [
    { name: 'PancakeSwap', address: '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3' },
  ],
};
/**
 * Returns routers for a chain, merging static defaults with optional JSON from env:
 * NEXT_PUBLIC_V2_ROUTERS_<chainId> = JSON.stringify([{ name, address }])
 */
export function getV2RoutersForChain(chainId: number): { name: string; address: Address }[] {
  let base = V2_ROUTERS[chainId] || [];

  // Merge curated JSON for BSC Mainnet/Testnet
  if (chainId === 56 || chainId === 97) {
    try {
      const extra = (V2_BSC as any as { name: string; address: Address; testnetAddress?: Address | null }[])
        .map((r) => ({ name: r.name, address: (chainId === 97 ? (r as any).testnetAddress : r.address) as Address }))
        .filter((r) => r.address);
      base = [...base, ...extra];
    } catch {}
  }
  const envKey = `NEXT_PUBLIC_V2_ROUTERS_${chainId}` as keyof typeof process.env;
  const raw = process.env[envKey];
  let merged = base.slice();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { name: string; address: Address }[];
      if (Array.isArray(parsed)) merged = [...merged, ...parsed.filter((r) => r && r.name && r.address)];
    } catch {}
  }
  // Dedupe by lowercase address, keep first occurrence
  const seen = new Set<string>();
  const deduped = merged.filter((r) => {
    const key = (r.address as string).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Stabilize order by name
  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
}
