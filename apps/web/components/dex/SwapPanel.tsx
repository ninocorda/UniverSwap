"use client";

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useBestRoute } from '../../hooks/useBestRoute';
import type { RouteCandidate } from '../../hooks/useBestRoute';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useBalance, useReadContract } from 'wagmi';
import { parseUnits, Address } from 'viem';
import { AggregatorRouterABI } from '../../lib/abi/AggregatorRouter';
import BlackHoleLoader from '../ui/BlackHoleLoader';
import { ERC20ABI } from '../../lib/abi/ERC20';
import { WBNB_ABI } from '../../lib/abi/WBNB';
import { getTokensForChain, getPreferDynamicTokenMap } from '../../lib/tokens/index';
import { getMergedTokensForChain } from '../../lib/tokens/index';
import { getEnvConfig } from '../../lib/env';
import { getAggregatorRouterForChain } from '../../lib/config';

// Minimal V2 router ABI for swapExactTokensForTokens
const V2_ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
];

// Minimal Algebra (THENA CL) router ABI for exactInputSingle
const ALGEBRA_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'limitSqrtPrice', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

export default function SwapPanel() {
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const { quote, best, all, loading, error, confidenceBps } = useBestRoute();
  const [slippage, setSlippage] = useState('0.50'); // %
  const chainIdRaw = useChainId();
  const chainId = chainIdRaw || 97; // default to BSC Testnet when no wallet connected
  const { address } = useAccount();
  const envCfg = useMemo(() => getEnvConfig(chainId), [chainId]);
  const feeBps = envCfg.platformFeeBps ?? 20; // 0.2% default
  const { data: txHash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [txError, setTxError] = useState<string | undefined>(undefined);

  const [tokens, setTokens] = useState<ReturnType<typeof getTokensForChain>>();
  const [addrTokens, setAddrTokens] = useState<Map<string, { symbol: string }>>();
  const [preferUni, setPreferUni] = useState<boolean>(false);
  useEffect(() => {
    setPreferUni(Boolean(envCfg.preferUniverswap));
  }, [envCfg.preferUniverswap]);
  // Load tokens: prefer dynamic tokenlists, fallback to static TokenMap
  useEffect(() => {
    let alive = true;
    // set immediate static fallback to avoid flicker
    setTokens(getTokensForChain(chainId));
    getPreferDynamicTokenMap(chainId).then((dyn) => {
      if (!alive) return;
      if (dyn) setTokens(dyn as any);
    }).catch(() => {});
    // Also fetch address-indexed tokens for path rendering
    getMergedTokensForChain(chainId).then((merged) => {
      if (!alive) return;
      const m = new Map<string, { symbol: string }>();
      setAddrTokens(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chainId]);
  const routerAddress = useMemo(() => getAggregatorRouterForChain(chainId), [chainId]);
  const tokenIn = useMemo(() => tokens && (tokens as any)[fromToken], [tokens, fromToken]);
  const tokenOut = useMemo(() => tokens && (tokens as any)[toToken], [tokens, toToken]);
  const invalidPair = useMemo(() => fromToken === toToken, [fromToken, toToken]);
  const invalidAmount = useMemo(() => !amount || Number(amount) <= 0, [amount]);

  // Ensure selected tokens are valid for the current chain
  useEffect(() => {
    if (!tokens) return;
    const keys = Object.keys(tokens);
    if (!keys.includes(fromToken)) {
      setFromToken(keys.includes('ETH') ? 'ETH' : keys[0]);
    }
    if (!keys.includes(toToken)) {
      setToToken(keys.includes('USDT') ? 'USDT' : keys[0]);
    }
  }, [chainId, tokens]);

  const { data: balIn } = useBalance({
    address,
    token: tokenIn?.address as Address | undefined,
    query: { enabled: !!address && !!tokenIn },
  });
  const { data: balOut } = useBalance({
    address,
    token: tokenOut?.address as Address | undefined,
    query: { enabled: !!address && !!tokenOut },
  });
  // Native balance (BNB on BSC). Useful when ETH maps to WBNB and user only has native gas token.
  const { data: balNative } = useBalance({
    address,
    query: { enabled: !!address },
  });

  return (
    <div className={clsx('rounded-xl border border-neutral-light/10 bg-white/5 p-5 backdrop-blur')}
    >
      <div className="text-neutral-light mb-4 text-lg font-medium">Swap</div>
      <div className="grid gap-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-light/70">From</label>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-light/10 bg-neutral-dark/40 px-3 py-2">
            {tokenIn?.logoURI && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tokenIn.logoURI as any} alt={fromToken} className="h-5 w-5 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="w-full bg-transparent text-neutral-light outline-none placeholder:text-neutral-light/40"
            />
            <select
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="rounded bg-neutral-dark/60 px-2 py-1 text-sm text-neutral-light"
            >
              {tokens && Object.keys(tokens).map((sym) => {
                const isBsc = chainId === 56 || chainId === 97;
                const label = sym === 'ETH' && isBsc ? 'BNB' : sym;
                return (
                  <option key={sym} value={sym}>{label}</option>
                );
              })}
            </select>
          </div>
          {fromToken === 'ETH' && balNative ? (
            <div className="mt-1 flex items-center justify-between text-xs text-neutral-light/50">
              <div>Balance: {balNative.formatted.slice(0, 12)} {balNative.symbol} (native)</div>
              {tokenIn && amount && (
                <button
                  className="rounded bg-white/10 px-2 py-1 text-neutral-light hover:bg-white/20"
                  onClick={() => {
                    try {
                      const value = parseUnits((amount as `${number}` as string) || '0', 18);
                      // Wrap native to WBNB by calling deposit() with value
                      writeContract({
                        abi: WBNB_ABI as any,
                        address: tokenIn.address as Address,
                        functionName: 'deposit',
                        args: [],
                        value,
                      });
                    } catch {}
                  }}
                >
                  Wrap
                </button>
              )}
            </div>
          ) : (
            balIn && (
              <div className="mt-1 text-right text-xs text-neutral-light/50">Balance: {balIn.formatted.slice(0, 12)} {balIn.symbol}</div>
            )
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-light/70">To</label>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-light/10 bg-neutral-dark/40 px-3 py-2">
            {tokenOut?.logoURI && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tokenOut.logoURI as any} alt={toToken} className="h-5 w-5 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
            )}
            <input
              value={best ? formatAmount(best.amountOut, tokenOut?.decimals ?? 18) : ''}
              readOnly
              placeholder="Quote"
              className="w-full bg-transparent text-neutral-light outline-none placeholder:text-neutral-light/40"
            />
            <select
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="rounded bg-neutral-dark/60 px-2 py-1 text-sm text-neutral-light"
            >
              {tokens && Object.keys(tokens).map((sym) => {
                const isBsc = chainId === 56 || chainId === 97;
                const label = sym === 'ETH' && isBsc ? 'BNB' : sym;
                return (
                  <option key={sym} value={sym}>{label}</option>
                );
              })}
            </select>
          </div>
          {balOut && (
            <div className="mt-1 text-right text-xs text-neutral-light/50">Balance: {balOut.formatted.slice(0, 12)} {balOut.symbol}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-light/70">Slippage</label>
          <input
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            inputMode="decimal"
            className="w-20 rounded bg-neutral-dark/60 px-2 py-1 text-sm text-neutral-light outline-none"
          />
          <span className="text-xs text-neutral-light/50">%</span>
          <label className="ml-4 flex items-center gap-2 text-xs text-neutral-light/80">
            <input type="checkbox" checked={preferUni} onChange={(e) => setPreferUni(e.target.checked)} />
            Prefer Universwap pools
          </label>
        </div>
        {best && (
          <div className="rounded-lg border border-neutral-light/10 bg-neutral-dark/40 p-3 text-xs text-neutral-light/80">
            <div className="flex items-center justify-between">
              <span>Best Route Found</span>
              <strong className="text-neutral-light">
                {best.kind === 'UniswapV3' ? `Uniswap V3 (fee ${best.fee / 1000}%)` : `${best.name}`}
              </strong>
            </div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center justify-between">
                <span>Price ({fromToken} → {toToken})</span>
                <strong className="text-neutral-light">
                  {formatPrice(best.forwardPrice, tokenIn?.decimals ?? 18, tokenOut?.decimals ?? 18)} {toToken}/{fromToken}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Price ({toToken} → {fromToken})</span>
                <strong className="text-neutral-light">
                  {formatPrice(best.reversePrice, tokenOut?.decimals ?? 18, tokenIn?.decimals ?? 18)} {fromToken}/{toToken}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Mid Price</span>
                <strong className="text-neutral-light">
                  {formatMid(best.forwardPrice, best.reversePrice)} {toToken}/{fromToken}
                </strong>
              </div>
            </div>
            {Array.isArray(all) && (
              <div className="mt-1 flex items-center justify-between">
                <span>Candidates</span>
                <span>{all.length}</span>
              </div>
            )}
            {typeof confidenceBps === 'number' && (
              <div className="mt-1 flex items-center justify-between">
                <span>Confidence</span>
                <span>{(confidenceBps / 100).toFixed(2)}%</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span>Platform fee</span>
              <span>{(feeBps / 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Estimated received (after fee)</span>
              <strong className="text-primary">{formatAmount(afterFee(best.amountOut, feeBps), tokenOut?.decimals ?? 18)}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Min received (slippage {slippage || '0.50'}%)</span>
              <strong>
                {(() => {
                  const s = Number(slippage || '0.5');
                  const min = best.amountOut - (best.amountOut * BigInt(Math.floor(s * 100))) / 10000n;
                  return formatAmount(min < 0n ? 0n : min, tokenOut?.decimals ?? 18);
                })()}
              </strong>
            </div>
            {best.kind === 'V2' && (
              <div className="mt-1 flex items-center justify-between">
                <span>Router</span>
                <a
                  href={`${chainId === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com'}/address/${(best as any).router}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  View on BscScan
                </a>
              </div>
            )}
            {all && all.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-neutral-light/60">Route breakdown</div>
                <ul className="grid gap-1">
                  {all.map((r: RouteCandidate, i: number) => {
                    const right = formatAmount(afterFee(r.amountOut, feeBps), tokenOut?.decimals ?? 18);
                    if (r.kind === 'UniswapV3') {
                      return (
                        <li key={i} className="flex items-center justify-between text-neutral-light/70">
                          <span>{`Uniswap V3 (fee ${r.fee / 1000}%)`}</span>
                          <span>{right}</span>
                        </li>
                      );
                    }
                    if (r.kind === 'Algebra') {
                      return (
                        <li key={i} className="flex items-center justify-between text-neutral-light/70">
                          <span>{r.name}</span>
                          <span>{right}</span>
                        </li>
                      );
                    }
                    // V2 path breakdown using symbols
                    const symbols = (r.kind === 'V2' ? r.path : []).map((addr: Address) => addrTokens?.get((addr as string).toLowerCase())?.symbol || ((addr as string).substring(0, 6) + '…'));
                    return (
                      <li key={i} className="flex items-center justify-between text-neutral-light/70">
                        <span>{`${r.name}: ${symbols.join(' → ')}`}</span>
                        <span>{right}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-neutral-light hover:opacity-90 disabled:opacity-50 btn-space"
            disabled={loading || invalidAmount || invalidPair}
            onClick={() => {
              // Aggregator quote across sources
              // @ts-ignore symbols are validated within the hook for supported chains
              quote(fromToken, toToken, amount, {
                preferUniverswap: preferUni,
                preferUniverswapBonusBps: envCfg.preferUniverswapBonusBps,
              });
            }}
          >
            <span className="mr-2 inline-block align-middle" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l6-2 2-6 6 6-6 2-2 6-6-6z"/></svg>
            </span>
            {loading ? 'Scanning the galaxy…' : 'Get Best Quote'}
          </button>
          {error && <span className="text-xs text-accent">{error}</span>}
        </div>

        {/* Approval + Swap */}
        <div className="mt-2 flex items-center gap-3">
          <button
            className="rounded bg-secondary px-3 py-2 text-sm text-neutral-light hover:opacity-90 disabled:opacity-50 btn-space"
            disabled={!best || invalidAmount || invalidPair || !address}
            onClick={async () => {
              if (!best) return;
              const token = tokenIn;
              if (!token) return;
              const spender = best.kind === 'V2'
                ? (best as any).router
                : best.kind === 'Algebra' && envCfg.algebraRouter
                  ? (envCfg.algebraRouter as Address)
                  : getAggregatorRouterForChain(chainId);
              const amt = parseUnits(amount as `${number}` as string, token.decimals);
              setTxError(undefined);
              try {
                await writeContract({
                  abi: ERC20ABI as any,
                  address: token.address as Address,
                  functionName: 'approve',
                  args: [spender as Address, amt],
                } as any);
              } catch (e: any) {
                setTxError(e?.shortMessage || e?.message || 'Approval failed');
              }
            }}
          >
            <span className="mr-2 inline-block align-middle" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/></svg>
            </span>
            Approve
          </button>
          <button
            className="rounded bg-accent px-4 py-2 text-neutral-dark hover:opacity-90 disabled:opacity-50 btn-space"
            disabled={!best || invalidAmount || invalidPair || best.kind !== 'V2' || !address}
            onClick={async () => {
              if (!best || best.kind !== 'V2') return;
              const token = tokenIn;
              if (!token) return;
              const amtIn = parseUnits(amount as `${number}` as string, token.decimals);
              const slippageNum = Number(slippage || '0.5');
              const minOut = best.amountOut - (best.amountOut * BigInt(Math.floor(slippageNum * 100))) / 10000n;
              const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
              setTxError(undefined);
              try {
                await writeContract({
                  abi: V2_ROUTER_ABI as any,
                  address: (best as any).router as Address,
                  functionName: 'swapExactTokensForTokens',
                  args: [amtIn, minOut < 0n ? 0n : minOut, (best as any).path as Address[], address as Address, deadline],
                } as any);
              } catch (e: any) {
                setTxError(e?.shortMessage || e?.message || 'Swap failed');
              }
            }}
          >
            <span className="mr-2 inline-block align-middle" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12h6l2-4 4 8 2-4h6l-5 8H7z"/></svg>
            </span>
            Swap (V2)
          </button>
          <button
            className="rounded bg-accent px-4 py-2 text-neutral-dark hover:opacity-90 disabled:opacity-50 btn-space"
            disabled={!best || invalidAmount || invalidPair || best.kind !== 'Algebra' || !address || !envCfg.enableAlgebra || !envCfg.algebraRouter}
            onClick={async () => {
              if (!best || best.kind !== 'Algebra') return;
              if (!tokenIn || !tokenOut) return;
              const amtIn = parseUnits(amount as `${number}` as string, (tokenIn?.decimals ?? 18));
              const slippageNum = Number(slippage || '0.5');
              const minOut = best.amountOut - (best.amountOut * BigInt(Math.floor(slippageNum * 100))) / 10000n;
              const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
              setTxError(undefined);
              try {
                await writeContract({
                  abi: ALGEBRA_ROUTER_ABI as any,
                  address: envCfg.algebraRouter as Address,
                  functionName: 'exactInputSingle',
                  args: [{
                    tokenIn: tokenIn.address as Address,
                    tokenOut: tokenOut.address as Address,
                    recipient: (address as Address),
                    deadline,
                    amountIn: amtIn,
                    amountOutMinimum: minOut < 0n ? 0n : minOut,
                    limitSqrtPrice: 0n,
                  }],
                } as any);
              } catch (e: any) {
                setTxError(e?.shortMessage || e?.message || 'Swap (CL) failed');
              }
            }}
          >
            <span className="mr-2 inline-block align-middle" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l6-2 2-6 6 6-2 6-6 2-6-6z"/></svg>
            </span>
            Swap (CL)
          </button>
        </div>

        <div className="text-xs text-neutral-light/70">
          {isPending && 'Submitting transaction…'}
          {isConfirming && ' Waiting for confirmations…'}
          {isConfirmed && txHash && (
            <span> Tx Confirmed: {txHash}</span>
          )}
          {txError && (
            <div className="mt-1 text-accent">{txError}</div>
          )}
        </div>

        {(isPending || isConfirming) && <BlackHoleLoader label={isPending ? 'Warping to mempool…' : 'Warp drive engaged…'} />}
      </div>
    </div>
  );
}

function formatAmount(x?: bigint, decimals: number = 18): string {
  if (!x) return '';
  const s = x.toString();
  if (decimals === 0) return s;
  if (s.length <= decimals) return `0.${s.padStart(decimals, '0').replace(/0+$/, '')}`.replace(/\.$/, '');
  const int = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

function afterFee(amountOut: bigint, feeBps: number): bigint {
  // approximate: apply fee on output side for display purposes
  return (amountOut * BigInt(10_000 - feeBps)) / 10_000n;
}

function formatPrice(value?: number, baseDecimals: number = 18, quoteDecimals: number = 18): string {
  if (!value || !Number.isFinite(value)) return '—';
  const normalized = value * 10 ** (quoteDecimals - baseDecimals);
  if (!Number.isFinite(normalized)) return '—';
  return normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function formatMid(forward?: number, reverse?: number): string {
  if (!forward || !reverse || !Number.isFinite(forward) || !Number.isFinite(reverse)) return '—';
  const mid = Math.sqrt(forward * reverse);
  if (!Number.isFinite(mid)) return '—';
  return mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}
