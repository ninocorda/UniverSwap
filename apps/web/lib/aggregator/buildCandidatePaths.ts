import { Address } from 'viem';

import { getTokensForChain, getWrappedNativeAddress } from '../tokens';

export type Path = Address[];

export interface CandidateRoute {
  /** Canonical ordered list of token addresses representing the swap path. */
  path: Path;
  /** Optional symbols (when available) for quick debugging/logging. */
  labels?: string[];
}

export interface BuildCandidatePathsParams {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  /**
   * Optional pool of bridge tokens (symbols or addresses) that should be considered
   * when generating multi-hop paths. Symbols are resolved via `getTokensForChain`.
   */
  routesPool?: (Address | string)[];
  /** Maximum number of candidate routes to return. Defaults to 30. */
  maxRoutes?: number;
}

const DEFAULT_STABLE_SYMBOLS = ['USDT', 'USDC', 'BUSD'] as const;
const MAX_DEFAULT_ROUTES = 30;

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function dedupeAddresses(items: (Address | undefined)[]): Address[] {
  const seen = new Set<string>();
  const result: Address[] = [];
  for (const item of items) {
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function resolveBridgeTokens(
  chainId: number,
  routesPool: (Address | string)[] | undefined,
  tokenIn: Address,
  tokenOut: Address
): { addresses: Address[]; labels: Record<string, string> } {
  const tokenMap = getTokensForChain(chainId) || {};
  const labelIndex: Record<string, string> = {};

  const resolved: (Address | undefined)[] = [];

  const wrapNative = getWrappedNativeAddress(chainId);
  if (wrapNative) {
    resolved.push(wrapNative as Address);
    labelIndex[wrapNative.toLowerCase()] = 'WBNB';
  }

  for (const symbol of DEFAULT_STABLE_SYMBOLS) {
    const token = (tokenMap as any)[symbol];
    if (token?.address) {
      resolved.push(token.address as Address);
      labelIndex[token.address.toLowerCase()] = symbol;
    }
  }

  if (routesPool && routesPool.length > 0) {
    for (const entry of routesPool) {
      if (typeof entry === 'string' && isAddress(entry)) {
        resolved.push(entry as Address);
      } else if (typeof entry === 'string') {
        const candidate = (tokenMap as any)[entry];
        if (candidate?.address) {
          resolved.push(candidate.address as Address);
          labelIndex[candidate.address.toLowerCase()] = entry;
        }
      }
    }
  }

  const excluded = new Set([tokenIn.toLowerCase(), tokenOut.toLowerCase()]);
  const addresses = dedupeAddresses(resolved).filter((addr) => !excluded.has(addr.toLowerCase()));

  return { addresses, labels: labelIndex };
}

function buildPathLabels(path: Address[], labelIndex: Record<string, string>): string[] {
  return path.map((addr) => labelIndex[addr.toLowerCase()] || addr);
}

/**
 * Generate a bounded set of candidate swap routes (paths) between two tokens.
 *
 * Paths are limited to a maximum depth of three hops (four tokens) and at most `maxRoutes` entries.
 */
export function buildCandidatePaths(params: BuildCandidatePathsParams): CandidateRoute[] {
  const { chainId, tokenIn, tokenOut, routesPool, maxRoutes = MAX_DEFAULT_ROUTES } = params;

  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    return [];
  }

  const { addresses: bridges, labels: labelIndex } = resolveBridgeTokens(chainId, routesPool, tokenIn, tokenOut);

  const candidates: CandidateRoute[] = [];
  const seen = new Set<string>();

  const pushPath = (path: Address[]) => {
    if (path.length < 2 || path.length > 4) return; // depth limit: max 3 hops (4 tokens)
    const key = path.map((addr) => addr.toLowerCase()).join('>');
    if (seen.has(key)) return;
    seen.add(key);
    if (candidates.length >= maxRoutes) return;
    candidates.push({ path, labels: buildPathLabels(path, labelIndex) });
  };

  // Direct path
  pushPath([tokenIn, tokenOut]);

  // Single bridge paths
  for (const bridge of bridges) {
    if (candidates.length >= maxRoutes) break;
    pushPath([tokenIn, bridge, tokenOut]);
  }

  // Double bridge paths (limited to maintain max depth and route count)
  for (let i = 0; i < bridges.length && candidates.length < maxRoutes; i++) {
    const first = bridges[i];
    for (let j = 0; j < bridges.length && candidates.length < maxRoutes; j++) {
      const second = bridges[j];
      if (first === second) continue;
      pushPath([tokenIn, first, second, tokenOut]);
    }
  }

  return candidates.slice(0, maxRoutes);
}
