"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { Address, parseUnits } from 'viem';
import { useChainId } from 'wagmi';
import { getTokensForChain } from '../lib/tokens';

export type QuoteParams = {
  fromSymbol?: string;
  toSymbol?: string;
  amountIn?: string; // decimal string (exact in)
  amountOut?: string; // decimal string (exact out)
  fee?: 500 | 3000 | 10000; // default 3000 (0.3%)
  // Optional direct addressing (used for custom tokens)
  fromAddress?: Address;
  toAddress?: Address;
  fromDecimals?: number;
  toDecimals?: number;
};

export type QuoteResult = {
  amountOut?: string; // decimal string (for exact in)
  amountInRequired?: string; // decimal string (for exact out)
  error?: string;
  loading: boolean;
  routerName?: string;
  routerAddress?: Address;
  path?: Address[];
};

export function useQuote() {
  const chainId = useChainId();
  const [state, setState] = useState<QuoteResult>({ loading: false });
  const timerRef = useRef<number | null>(null);

  const quote = useCallback(
    async ({ fromSymbol, toSymbol, amountIn, amountOut, fromAddress, toAddress, fromDecimals, toDecimals }: QuoteParams) => {
      // Clear previous debounce
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(async () => {
        try {
          const cid = chainId || 97; // default to BSC Testnet when no wallet connected
          const tokenMap = getTokensForChain(cid) || {};
          const from = fromAddress && typeof fromDecimals === 'number' ? { address: fromAddress, decimals: fromDecimals } : (tokenMap as any)[fromSymbol!];
          const to = toAddress && typeof toDecimals === 'number' ? { address: toAddress, decimals: toDecimals } : (tokenMap as any)[toSymbol!];
          if (!from || !to) throw new Error('Token not supported');
          const isExactIn = !!amountIn && Number(amountIn) > 0;
          const isExactOut = !!amountOut && Number(amountOut) > 0;
          if (!isExactIn && !isExactOut) throw new Error('Enter an amount');

          setState({ loading: true });

          const mode = isExactIn ? 'exact-in' : 'exact-out';
          const parsedAmount = isExactIn
            ? parseUnits(amountIn as `${number}` as string, from.decimals)
            : parseUnits(amountOut as `${number}` as string, to.decimals);

          const res = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: cid,
              tokenIn: from.address,
              tokenOut: to.address,
              amount: parsedAmount.toString(),
              mode,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Quote failed');

          const routePath = Array.isArray(data?.path) && data.path.length >= 2 ? (data.path as Address[]) : [from.address as Address, to.address as Address];

          if (mode === 'exact-in') {
            const out = BigInt(String(data.amountOut || '0'));
            const amountOutStr = formatUnitsSafe(out, to.decimals);
            setState({ loading: false, amountOut: amountOutStr, routerName: data?.router?.name, routerAddress: data?.router?.address, path: routePath });
          } else {
            const reqIn = BigInt(String(data.amountIn || '0'));
            const amountInStr = formatUnitsSafe(reqIn, from.decimals);
            setState({ loading: false, amountInRequired: amountInStr, routerName: data?.router?.name, routerAddress: data?.router?.address, path: routePath });
          }
        } catch (e: any) {
          setState({ loading: false, error: e?.message || 'Quote failed' });
        }
      }, 250); // 250ms debounce
    },
    [chainId]
  );

  return { quote, amountOut: state.amountOut, amountInRequired: state.amountInRequired, loading: state.loading, error: state.error, routerName: state.routerName, routerAddress: state.routerAddress, path: state.path };
}

function formatUnitsSafe(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const s = value.toString().padStart(decimals + 1, '0');
  const int = s.slice(0, -decimals) || '0';
  const frac = s.slice(-decimals).replace(/0+$/, '');
  const result = frac ? `${int}.${frac}` : int;
  // Ensure we always use dot as decimal separator, not comma
  return result.replace(',', '.');
}
