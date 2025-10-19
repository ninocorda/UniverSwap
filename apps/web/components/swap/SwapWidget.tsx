"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { getNativeSymbol, getTokensForChain, getTokenInfo } from "../../lib/tokens";
import { useQuote } from "../../hooks/useQuote";
import { useSwap } from "../../hooks/useSwap";
import { useToast } from "../ui/Toast";
import { ERC20_ABI } from "../../lib/abis/erc20";

// Base64 encoded 1x1 transparent pixel
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

type TokenLogoOptions = {
  symbol?: string | null;
  address?: string | null;
  logoURI?: string | null;
};

type TokenSelectEntry = {
  address: Address;
  decimals: number;
  symbol: string;
  name?: string;
  logoURI?: string;
  chainLabel?: string;
};

type TokenSelectMap = Record<string, TokenSelectEntry>;

const normalizeAmountInput = (value: string): string => {
  if (!value) return "";
  const sanitized = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (!sanitized) return "";
  const firstDot = sanitized.indexOf(".");
  if (firstDot === -1) return sanitized;
  const integerPart = sanitized.slice(0, firstDot) || "0";
  const decimalPart = sanitized.slice(firstDot + 1).replace(/\./g, "");
  if (!decimalPart) return `${integerPart}.`;
  return `${integerPart}.${decimalPart}`;
};

const formatDecimalDisplay = (value: string): string => {
  if (!value) return "0";
  const normalized = value.replace(/,/g, ".");
  if (!normalized.includes(".")) {
    return normalized;
  }
  const [integerPart, fractionalPart = ""] = normalized.split(".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  if (!trimmedFraction) {
    return integerPart || "0";
  }
  return `${integerPart || "0"}.${trimmedFraction}`;
};

// Helper function to get token logo URL
const getTokenLogoURL = (options?: TokenLogoOptions): string => {
  if (!options) return TRANSPARENT_PIXEL;

  const { address, symbol, logoURI } = options;

  if (logoURI) {
    return logoURI;
  }

  if (address) {
    return `/images/tokens/images/${address}.png`;
  }

  if (symbol) {
    return `/images/tokens/images/${symbol.toLowerCase()}.png`;
  }

  return TRANSPARENT_PIXEL;
};

function TokenSelect({ 
  value, 
  onChange, 
  tokens,
  tokenMap,
  className = "",
  onMax,
  showMax = false,
  amount,
  onAmountChange,
  label,
  readOnly = false,
  disableAmountInput = false,
  customAddress,
  onCustomAddressChange,
  customError,
  onCustomErrorChange,
  onImportToken
}: { 
  value: string; 
  onChange: (value: string) => void; 
  tokens: string[];
  tokenMap: TokenSelectMap;
  className?: string;
  onMax?: (maxAmount: string) => void;
  showMax?: boolean;
  amount?: string;
  onAmountChange?: (value: string) => void;
  label: string;
  readOnly?: boolean;
  disableAmountInput?: boolean;
  customAddress?: string;
  onCustomAddressChange?: (value: string) => void;
  customError?: string;
  onCustomErrorChange?: (value: string) => void;
  onImportToken?: () => Promise<string | undefined>;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedToken = tokenMap[value];
  const logoUrl = selectedToken ? getTokenLogoURL(selectedToken) : '';
  const [balance, setBalance] = useState<string>("0.0");
  const [importing, setImporting] = useState(false);

  // Fetch wallet balance for selected token (native for BNB/ETH, ERC20 otherwise)
  useEffect(() => {
    let cancelled = false;
    async function loadBalance() {
      try {
        if (!address || !publicClient || !selectedToken) {
          if (!cancelled) setBalance("0.0");
          return;
        }
        const sym = (selectedToken.symbol || '').toUpperCase();
        if (sym === 'BNB') {
          const wei = await publicClient.getBalance({ address });
          const s = formatDecimalDisplay(formatUnits(wei, 18));
          if (!cancelled) setBalance(s || '0.0');
          return;
        }
        if (sym === 'ETH') {
          // ETH on BSC testnet is not native, so check balance as 0
          if (!cancelled) setBalance('0.0');
          return;
        }
        const bal = await publicClient.readContract({
          address: selectedToken.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as unknown as bigint;
        const s = formatDecimalDisplay(formatUnits(bal || 0n, selectedToken.decimals || 18));
        if (!cancelled) setBalance(s || '0.0');
      } catch {
        if (!cancelled) setBalance("0.0");
      }
    }
    loadBalance();
    return () => { cancelled = true; };
  }, [address, publicClient, selectedToken?.address, selectedToken?.symbol, selectedToken?.decimals]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const query = searchQuery.toLowerCase();
    return tokens.filter(symbol => {
      const token = tokenMap[symbol];
      return (
        symbol.toLowerCase().includes(query) ||
        token?.name?.toLowerCase().includes(query) ||
        token?.address?.toLowerCase() === query.toLowerCase()
      );
    });
  }, [tokens, tokenMap, searchQuery]);

  return (
    <div className={`bg-zinc-800/50 rounded-2xl p-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-400">Balance: {balance}</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(true);
          }}
          className={`flex items-center gap-3 ${readOnly ? 'bg-zinc-800/40 hover:bg-zinc-800/60' : 'bg-zinc-700/50 hover:bg-zinc-700/70'} px-3 py-2 rounded-2xl transition-colors min-w-[160px]`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={selectedToken?.symbol || 'Select token'}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (selectedToken?.address && !target.dataset.addrLower) {
                  target.dataset.addrLower = "true";
                  target.src = `/images/tokens/images/${selectedToken.address.toLowerCase()}.png`;
                  return;
                }
                if (selectedToken?.symbol && !target.dataset.symbolLower) {
                  target.dataset.symbolLower = "true";
                  target.src = `/images/tokens/images/${selectedToken.symbol.toLowerCase()}.png`;
                  return;
                }
                if (selectedToken?.logoURI && target.src !== selectedToken.logoURI) {
                  target.src = selectedToken.logoURI;
                  return;
                }
                if (target.src !== TRANSPARENT_PIXEL) {
                  target.src = TRANSPARENT_PIXEL;
                }
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-600 flex items-center justify-center">
              <span className="text-sm font-semibold">{selectedToken?.symbol?.[0] || '?'}</span>
            </div>
          )}
          <div className="flex flex-col items-start text-left">
            <span className="text-lg font-semibold text-white leading-tight">{selectedToken?.symbol || 'Select'}</span>
            <span className="text-xs text-zinc-400">{selectedToken?.chainLabel || selectedToken?.name || 'Choose a token'}</span>
          </div>
          <svg width="12" height="7" viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-zinc-400">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange?.(normalizeAmountInput(e.target.value))}
            placeholder="0.0"
            className="w-full bg-transparent border-none text-2xl text-white focus:outline-none focus:ring-0 p-0 text-right"
            disabled={readOnly || disableAmountInput}
          />
        </div>
      </div>
      
      {showMax && onMax && (
        <div className="mt-1 flex justify-end">
          <button 
            onClick={() => onMax(balance)}
            className="text-xs text-[#1FC7D4] hover:opacity-80 transition-opacity"
          >
            Max
          </button>
        </div>
      )}

      {/* Token selection modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setIsOpen(false)}>
          <div className="w-full max-w-md bg-[#1E1E1E] rounded-3xl shadow-xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-semibold text-white">Select a token</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-zinc-800/50 transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or paste address"
                  className="w-full bg-[#2D2D2D] text-white px-4 py-3 pl-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1FC7D4] text-sm"
                  autoFocus
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Common tokens row */}
              <div className="flex flex-wrap gap-2 mb-4">
                {['BNB', 'BUSD', 'USDT', 'USDC', 'ETH', 'CAKE', 'BTCB'].map((commonToken) => (
                  <button
                    key={commonToken}
                    onClick={() => {
                      onChange(commonToken);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 bg-[#2D2D2D] hover:bg-[#3D3D3D] rounded-full text-sm text-white transition-colors"
                  >
                    {commonToken}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-[#2D2D2D] overflow-y-auto flex-1">
              {filteredTokens.length > 0 ? (
                <ul className="divide-y divide-[#2D2D2D]">
                  {filteredTokens.map((symbol) => (
                    <li key={symbol}>
                      <button
                        onClick={() => {
                          onChange(symbol);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-5 py-3 hover:bg-[#2D2D2D] flex items-center gap-3 text-left transition-colors"
                      >
                        <div className="relative">
                          {tokenMap[symbol] ? (
                            <img 
                              src={getTokenLogoURL(tokenMap[symbol])} 
                              alt={tokenMap[symbol]?.symbol} 
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (tokenMap[symbol]?.address && !target.dataset.addrLower) {
                                  target.dataset.addrLower = "true";
                                  target.src = `/images/tokens/images/${tokenMap[symbol].address.toLowerCase()}.png`;
                                  return;
                                }
                                if (tokenMap[symbol]?.symbol && !target.dataset.symbolLower) {
                                  target.dataset.symbolLower = "true";
                                  target.src = `/images/tokens/images/${tokenMap[symbol].symbol.toLowerCase()}.png`;
                                  return;
                                }
                                if (tokenMap[symbol]?.logoURI && target.src !== tokenMap[symbol].logoURI) {
                                  target.src = tokenMap[symbol].logoURI;
                                  return;
                                }
                                if (target.src !== TRANSPARENT_PIXEL) {
                                  target.src = TRANSPARENT_PIXEL;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#3D3D3D] flex items-center justify-center">
                              <span className="text-xs text-white">{symbol?.[0] || '?'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{tokenMap[symbol]?.symbol || symbol}</div>
                          {(tokenMap[symbol]?.chainLabel || tokenMap[symbol]?.name) && (
                            <div className="text-xs text-zinc-400 truncate">{tokenMap[symbol]?.chainLabel || tokenMap[symbol]?.name}</div>
                          )}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-zinc-500">
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-zinc-400">
                  <div className="text-2xl mb-2">
                    <svg className="inline-block w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm">No results found.</p>
                  <p className="text-xs mt-1 text-zinc-500">Try another search term</p>
                </div>
              )}
            </div>
            
            {onImportToken && (
              <div className="p-5 border-t border-[#2D2D2D]">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={customAddress || ""}
                    onChange={(e) => {
                      onCustomAddressChange?.(e.target.value);
                      if (customError) onCustomErrorChange?.("");
                    }}
                    placeholder="0x..."
                    className="w-full bg-[#2D2D2D] text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1FC7D4] text-sm"
                  />
                  {customError && <div className="text-xs text-rose-400">{customError}</div>}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (importing || !onImportToken) return;
                      setImporting(true);
                      try {
                        const sym = await onImportToken();
                        if (sym) {
                          onChange(sym);
                          setIsOpen(false);
                          setSearchQuery('');
                        }
                      } finally {
                        setImporting(false);
                      }
                    }}
                    disabled={importing}
                    className="w-full py-3.5 border border-[#2D2D2D] rounded-2xl text-[#1FC7D4] font-medium hover:bg-[#2D2D2D] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3.33334V12.6667M3.33333 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {importing ? 'Importing…' : 'Import Token'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapWidget() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { quote, amountOut, amountInRequired, loading: quoting, error: quoteError, routerAddress, routerName, path } = useQuote();
  const { approveIfNeeded, swapExactTokensForTokens, approving, swapping, txHash, error: swapError } = useSwap();
  const { addToast } = useToast();

  const activeChainId = chainId || 97;
  const networkLabel = activeChainId === 56 || activeChainId === 97 ? "BNB Chain" : undefined;

  const baseTokenMap = useMemo<TokenSelectMap>(() => {
    const base = getTokensForChain(activeChainId) || {};
    const map: TokenSelectMap = {};
    for (const [symbol, token] of Object.entries(base as Record<string, { address: Address; decimals: number }>)) {
      if (!token?.address) continue;
      const info = getTokenInfo(activeChainId, token.address as string);
      map[symbol] = {
        address: token.address,
        decimals: token.decimals,
        symbol,
        name: info?.name ?? symbol,
        logoURI: info?.logo,
        chainLabel: networkLabel,
      };
    }
    return map;
  }, [activeChainId, networkLabel]);

  const [customTokens, setCustomTokens] = useState<TokenSelectMap>({});

  const tokenMap = useMemo<TokenSelectMap>(() => ({ ...baseTokenMap, ...customTokens }), [baseTokenMap, customTokens]);
  const symbols = useMemo(() => Object.keys(tokenMap), [tokenMap]);
  const nativeSym = useMemo(() => getNativeSymbol(activeChainId) || "BNB", [activeChainId]);

  const [fromSymbol, setFromSymbol] = useState<string>("ETH");
  const [toSymbol, setToSymbol] = useState<string>("USDT");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOutExact, setAmountOutExact] = useState<string>("");
  const [isExactOutMode, setIsExactOutMode] = useState<boolean>(false);
  const [slippageBps, setSlippageBps] = useState<string>("50"); // 0.5%
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);
  const [slippageInput, setSlippageInput] = useState<string>("");
  const [slippageError, setSlippageError] = useState<string | null>(null);
  const [customAddr, setCustomAddr] = useState<string>("");
  const [customErr, setCustomErr] = useState<string>("");

  // TEMP: scan liquidity in testnet
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | undefined>(undefined);
  const [scanResults, setScanResults] = useState<{ pair: string; forward: any; reverse: any }[] | undefined>(undefined);

  async function onScanLiquidity() {
    try {
      setScanLoading(true);
      setScanError(undefined);
      setScanResults(undefined);
      const res = await fetch('/api/scan-liquidity');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Scan failed');
      }
      const data = await res.json();
      setScanResults(data?.pairs || []);
    } catch (e: any) {
      setScanError(e?.message || 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  }

  const fromToken = tokenMap[fromSymbol];
  const toToken = tokenMap[toSymbol];

  const slippagePercentValue = useMemo(() => {
    const value = Number(slippageBps);
    if (!Number.isFinite(value) || value < 0) return 0.5;
    return value / 100;
  }, [slippageBps]);

  const slippageFraction = useMemo(() => slippagePercentValue / 100, [slippagePercentValue]);
  const slippagePercentDisplay = useMemo(() => formatDecimalDisplay(slippagePercentValue.toFixed(2)), [slippagePercentValue]);
  const isAutoSlippage = slippageBps === "50";

  const minimumReceivedDisplay = useMemo(() => {
    if (isExactOutMode) {
      const target = Number(amountOutExact || "0");
      if (!Number.isFinite(target)) return "0.000000";
      return formatDecimalDisplay(target.toFixed(6));
    }
    const quoted = Number(amountOut || "0");
    if (!Number.isFinite(quoted)) return "0.000000";
    const min = quoted * Math.max(0, 1 - slippageFraction);
    return formatDecimalDisplay(min.toFixed(6));
  }, [amountOut, amountOutExact, isExactOutMode, slippageFraction]);

  const handleOpenSlippageModal = useCallback(() => {
    setSlippageInput(slippagePercentValue.toFixed(2));
    setSlippageError(null);
    setIsSlippageModalOpen(true);
  }, [slippagePercentValue]);

  const handleCloseSlippageModal = useCallback(() => {
    setIsSlippageModalOpen(false);
    setSlippageError(null);
  }, []);

  const handleApplyCustomSlippage = useCallback(() => {
    const valueRaw = (slippageInput || "").trim();
    if (!valueRaw) {
      setSlippageError("Ingresa un valor");
      return;
    }
    const percent = Number(valueRaw);
    if (!Number.isFinite(percent)) {
      setSlippageError("Valor inválido");
      return;
    }
    if (percent < 0 || percent > 50) {
      setSlippageError("Debe estar entre 0% y 50%");
      return;
    }
    const bps = Math.round(percent * 100);
    setSlippageBps(bps.toString());
    setSlippageError(null);
    setIsSlippageModalOpen(false);
  }, [slippageInput]);

  // Ensure selected symbols exist and are not identical
  useEffect(() => {
    if (!symbols || symbols.length === 0) return;
    const hasFrom = !!tokenMap[fromSymbol];
    const hasTo = !!tokenMap[toSymbol];

    // If either symbol is missing, pick a fallback from available symbols
    if (!hasFrom) {
      const fallback = symbols.find((s) => s !== toSymbol);
      if (fallback) setFromSymbol(fallback);
    }
    if (!hasTo) {
      const fallback = symbols.find((s) => s !== fromSymbol);
      if (fallback) setToSymbol(fallback);
    }

    // Avoid selecting the same token for both sides
    if (fromSymbol === toSymbol) {
      const alt = symbols.find((s) => s !== fromSymbol);
      if (alt) setToSymbol(alt);
    }
  }, [symbols, tokenMap, fromSymbol, toSymbol]);

  // Toast when a tx hash is available (submitted/pending)
  useEffect(() => {
    if (!txHash) return;
    const base = activeChainId === 97 ? "https://testnet.bscscan.com/tx/" : activeChainId === 56 ? "https://bscscan.com/tx/" : undefined;
    addToast({
      kind: "info",
      title: "Transaction submitted",
      message: txHash,
      linkHref: base ? `${base}${txHash}` : undefined,
      linkLabel: "View on explorer",
    });
  }, [txHash]);

  // Trigger quote when inputs change
  useEffect(() => {
    if (!fromToken || !toToken) return;
    if (isExactOutMode) return;
    if (!amountIn) return;
    quote({
      fromSymbol: fromSymbol as any,
      toSymbol: toSymbol as any,
      amountIn,
      fromAddress: fromToken.address as Address,
      toAddress: toToken.address as Address,
      fromDecimals: fromToken.decimals,
      toDecimals: toToken.decimals,
    });
  }, [fromSymbol, toSymbol, amountIn, isExactOutMode, fromToken, toToken]);

  useEffect(() => {
    if (!fromToken || !toToken) return;
    if (!isExactOutMode) return;
    if (!amountOutExact) {
      if (amountIn) setAmountIn("");
      return;
    }
    quote({
      fromSymbol: fromSymbol as any,
      toSymbol: toSymbol as any,
      amountOut: amountOutExact,
      fromAddress: fromToken.address as Address,
      toAddress: toToken.address as Address,
      fromDecimals: fromToken.decimals,
      toDecimals: toToken.decimals,
    });
  }, [fromSymbol, toSymbol, amountOutExact, isExactOutMode, fromToken, toToken]);

  useEffect(() => {
    if (!isExactOutMode) return;
    if (!amountOutExact) {
      if (amountIn) setAmountIn("");
      return;
    }
    if (!amountInRequired) {
      if (amountIn) setAmountIn("");
      return;
    }
    const normalized = normalizeAmountInput(amountInRequired);
    if (normalized !== amountIn) {
      setAmountIn(normalized);
    }
  }, [amountOutExact, amountInRequired, isExactOutMode, amountIn]);

  const canSwap = useMemo(() => {
    if (!address || !fromToken || !toToken || !routerAddress) return false;
    if (isExactOutMode) {
      return !!amountOutExact && Number(amountOutExact) > 0 && !!amountInRequired && Number(amountInRequired) > 0;
    }
    return !!amountIn && Number(amountIn) > 0 && !!amountOut && Number(amountOut) > 0;
  }, [address, fromToken, toToken, amountIn, amountOut, amountOutExact, amountInRequired, isExactOutMode, routerAddress]);
  async function onSwap() {
    if (!canSwap) return;
    try {
      const isNativeIn = fromSymbol === 'BNB';
      const isNativeOut = toSymbol === 'BNB';
      addToast({ kind: "info", title: "Processing", message: isNativeIn ? "Submitting swap (native BNB)" : "Checking allowance and submitting swap" });
      // Note: current swap hook implements exact-in swaps; for exact-out you'd use a different method.
      const finalAmountIn = isExactOutMode ? (amountInRequired || "") : amountIn;
      const finalAmountOut = isExactOutMode ? amountOutExact : (amountOut || "");
      await swapExactTokensForTokens({
        tokenIn: fromToken.address as Address,
        tokenOut: toToken.address as Address,
        amountIn: finalAmountIn,
        amountOutQuoted: finalAmountOut,
        tokenInDecimals: fromToken.decimals,
        tokenOutDecimals: toToken.decimals,
        router: routerAddress as Address,
        slippageBps: Number(slippageBps || 50),
        isNativeIn,
        isNativeOut,
        path: path as Address[] | undefined,
      });
      const base = activeChainId === 97 ? "https://testnet.bscscan.com/tx/" : activeChainId === 56 ? "https://bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Swap confirmed", message: txHash ? txHash : "Transaction confirmed", linkHref: txHash && base ? `${base}${txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || "Swap failed";
      addToast({ kind: "error", title: "Swap error", message: msg });
    }
  }

  const importCustomToken = useCallback(async (): Promise<string | undefined> => {
    try {
      setCustomErr("");
      const addr = (customAddr || "").trim() as Address;
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        setCustomErr("Invalid address");
        return undefined;
      }
      if (!publicClient) {
        setCustomErr("Public client not ready");
        return undefined;
      }
      const [decimals, symbol] = await Promise.all([
        publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals", args: [] }) as Promise<number>,
        publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol", args: [] }) as Promise<string>,
      ]);
      let sym = (symbol || "TOKEN").toUpperCase();
      // Avoid collisions with existing symbols
      if (tokenMap[sym] || customTokens[sym]) {
        let i = 2;
        while (tokenMap[`${sym}${i}`] || customTokens[`${sym}${i}`]) i++;
        sym = `${sym}${i}`;
      }
      setCustomTokens((m) => ({
        ...m,
        [sym]: {
          address: addr,
          decimals,
          symbol: sym,
          name: sym,
          chainLabel: networkLabel,
        },
      }));
      setCustomAddr("");
      addToast({ kind: "success", title: "Token added", message: `${sym} ready to use` });
      return sym;
    } catch (e: any) {
      setCustomErr(e?.shortMessage || e?.message || "Failed to add token");
      return undefined;
    }
  }, [addToast, customAddr, customTokens, networkLabel, publicClient, tokenMap]);

  const handleSwitchTokens = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmountIn("");
    setAmountOutExact("");
    setIsExactOutMode(false);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900/80 backdrop-blur-sm rounded-3xl p-5 shadow-xl border border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Swap</h2>
        <button className="p-2 rounded-full hover:bg-zinc-800/50 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#7A6EAA"/>
            <path d="M12 19.5C13.1411 19.5 14 18.7165 14 17.6667C14 16.6168 13.1411 15.8333 12 15.8333C10.8589 15.8333 10 16.6168 10 17.6667C10 18.7165 10.8589 19.5 12 19.5Z" fill="#7A6EAA"/>
            <path d="M12 8.16667C13.1411 8.16667 14 7.38318 14 6.33333C14 5.28349 13.1411 4.5 12 4.5C10.8589 4.5 10 5.28349 10 6.33333C10 7.38318 10.8589 8.16667 12 8.16667Z" fill="#7A6EAA"/>
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* From Section */}
        <TokenSelect
          value={fromSymbol}
          onChange={setFromSymbol}
          tokens={symbols}
          tokenMap={tokenMap}
          amount={amountIn}
          onAmountChange={(value) => {
            setIsExactOutMode(false);
            setAmountOutExact("");
            setAmountIn(value);
          }}
          label="From"
          showMax={true}
          onMax={(maxAmount) => {
            // For native coin, leave a tiny buffer for gas
            const sym = (fromSymbol || '').toUpperCase();
            if (sym === 'BNB' && Number(maxAmount) > 0.001) {
              const adjusted = (Number(maxAmount) - 0.001).toString();
              setAmountIn(normalizeAmountInput(adjusted));
              return;
            }
            setAmountIn(normalizeAmountInput(maxAmount));
          }}
          customAddress={customAddr}
          onCustomAddressChange={setCustomAddr}
          customError={customErr}
          onCustomErrorChange={setCustomErr}
          onImportToken={importCustomToken}
        />

        {/* Switch Button */}
        <div className="flex justify-center -my-2 z-10 relative">
          <button
            onClick={handleSwitchTokens}
            className="p-2 bg-zinc-800 rounded-full border-2 border-zinc-900 hover:bg-zinc-700 transition-colors shadow-lg"
            aria-label="Switch tokens"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        {/* To Section */}
        <TokenSelect
          value={toSymbol}
          onChange={setToSymbol}
          tokens={symbols}
          tokenMap={tokenMap}
          amount={isExactOutMode ? amountOutExact : (amountOut || "")}
          onAmountChange={(v) => {
            setIsExactOutMode(true);
            setAmountOutExact(v);
          }}
          label="To"
          customAddress={customAddr}
          onCustomAddressChange={setCustomAddr}
          customError={customErr}
          onCustomErrorChange={setCustomErr}
          onImportToken={importCustomToken}
        />

        {/* Swap Button */}
        <button
          onClick={onSwap}
          disabled={!canSwap || approving || swapping}
          className="w-full py-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {approving ? 'Approving...' : swapping ? 'Swapping...' : !canSwap ? (isExactOutMode ? (!amountOutExact ? 'Enter an amount' : 'Fetching quote...') : 'Enter an amount') : 'Swap'}
        </button>

        {/* TEMP: Scan Liquidity Button */}
        <div className="flex justify-center">
          <button
            onClick={onScanLiquidity}
            disabled={scanLoading}
            className="text-sm text-[#1FC7D4] hover:opacity-80"
          >
            {scanLoading ? 'Scanning liquidity…' : 'Scan liquidity (temp)'}
          </button>
        </div>

        {scanError && (
          <div className="text-amber-400 text-sm text-center">{scanError}</div>
        )}

        {scanResults && scanResults.length > 0 && (
          <div className="bg-zinc-800/40 rounded-2xl p-3 text-sm max-h-64 overflow-auto">
            <div className="text-zinc-300 mb-2">Pairs with liquidity (testnet):</div>
            <ul className="space-y-2">
              {scanResults.map((r, idx) => {
                const [symA, symB] = r.pair.split('/') as [string, string];
                const tokA = tokenMap[symA];
                const tokB = tokenMap[symB];
                const fmt = (val?: string, dec?: number) => {
                  try { return val && typeof dec === 'number' ? (Number(formatUnits(BigInt(val), dec)).toPrecision(6)) : undefined; } catch { return undefined; }
                };
                const fAmtOut = r.forward ? fmt(r.forward.amountOut, tokB?.decimals) : undefined;
                const rAmtOut = r.reverse ? fmt(r.reverse.amountOut, tokA?.decimals) : undefined;
                return (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <button
                      className="text-left flex-1 hover:opacity-80"
                      onClick={() => { setFromSymbol(symA); setToSymbol(symB); }}
                    >
                      <div className="text-white">{r.pair}</div>
                      <div className="text-xs text-zinc-400">
                        {r.forward ? `1 ${symA} → ~${fAmtOut || '?'} ${symB} (${r.forward.router || 'router'})` : ''}
                        {r.forward && r.reverse ? ' • ' : ''}
                        {r.reverse ? `1 ${symB} → ~${rAmtOut || '?'} ${symA} (${r.reverse.router || 'router'})` : ''}
                      </div>
                    </button>
                    <span className="text-zinc-500 text-xs">{r.forward ? '→' : ''}{r.reverse ? ' ←' : ''}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Transaction Settings */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleOpenSlippageModal}
            className="text-sm text-[#1FC7D4] hover:opacity-80 flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1FC7D4]/30 bg-zinc-800/40 transition-colors"
          >
            <span>{`${isAutoSlippage ? 'Auto' : 'Custom'}: ${slippagePercentDisplay}%`}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isSlippageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={handleCloseSlippageModal}>
            <div className="w-full max-w-sm bg-[#1E1E1E] rounded-3xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-[#2D2D2D] flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Slippage tolerance</h3>
                <button onClick={handleCloseSlippageModal} className="p-1 rounded-full hover:bg-zinc-800/60 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="px-5 py-5 space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Presets</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 50, 100].map((preset) => {
                      const presetPercent = (preset / 100).toFixed(2).replace(',', '.').replace(/0+$/, '').replace(/\.$/, '');
                      const active = slippageBps === preset.toString();
                      return (
                        <button
                          key={preset}
                          onClick={() => {
                            setSlippageBps(preset.toString());
                            setSlippageInput(presetPercent);
                            setSlippageError(null);
                            setIsSlippageModalOpen(false);
                          }}
                          className={`py-3 rounded-2xl text-sm font-medium transition-colors border ${active ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#C4B5FD]' : 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700/70'}`}
                        >
                          {presetPercent}%
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Personalizado</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slippageInput}
                      onChange={(e) => {
                        setSlippageInput(e.target.value);
                        if (slippageError) setSlippageError(null);
                      }}
                      placeholder="0.50"
                      className="flex-1 bg-zinc-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#1FC7D4]"
                    />
                    <span className="text-sm text-zinc-400">%</span>
                    <button
                      onClick={handleApplyCustomSlippage}
                      className="px-4 py-3 rounded-2xl bg-[#8B5CF6] text-white font-semibold hover:bg-[#7C3AED] transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                  {slippageError && <div className="text-xs text-rose-400 mt-2">{slippageError}</div>}
                  <div className="text-xs text-zinc-500 mt-3">Valores entre 0.10% y 1.00% son comunes. Ajusta según la volatilidad del mercado.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Details - Only show when there's a quote */}
        {((amountOut && !isExactOutMode) || (amountInRequired && isExactOutMode) || quoting) && (
          <div className="mt-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Expected Output</span>
              <span>{!isExactOutMode ? (amountOut || '0.0') : amountOutExact || '0.0'} {toSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Price Impact</span>
              <span>0.05%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Minimum received</span>
              <span>{minimumReceivedDisplay} {toSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Network Fee</span>
              <span>~$0.12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Route</span>
              <span>{path ? path.join(' → ') : '—'}</span>
            </div>
            {isExactOutMode && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Required Input</span>
                <span>{amountInRequired || '0.0'} {fromSymbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Messages */}
        {quoteError && <div className="text-amber-400 text-sm mt-2">{quoteError}</div>}
        {swapError && <div className="text-amber-400 text-sm mt-2">{swapError}</div>}

        {/* Transaction Link */}
        {txHash && (
          <div className="mt-3 text-sm">
            <div className="text-zinc-400">Transaction:</div>
            <div className="break-all">
              {txHash}
              {(() => {
                const base = activeChainId === 97 ? "https://testnet.bscscan.com/tx/" : activeChainId === 56 ? "https://bscscan.com/tx/" : undefined;
                return base ? (
                  <>
                    {" "}
                    <a href={`${base}${txHash}`} target="_blank" rel="noreferrer" className="text-[#1FC7D4] hover:underline">View on BscScan</a>
                  </>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwapWidget;
