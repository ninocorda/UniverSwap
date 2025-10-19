"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Address, parseUnits, formatUnits } from "viem";
import { getTokensForChain, getNativeSymbol, getWrappedNativeAddress } from "../../lib/tokens";
import { useV3Liquidity } from "../../hooks/useV3Liquidity";
import { useToast } from "../ui/Toast";
import { ERC20_ABI } from "../../lib/abis/erc20";
import { PANCAKE_V3_97 } from "../../lib/pancakeV3";
import { QUOTER_V2_ABI } from "../../lib/abis/quoterV2";

const FULL_RANGE = { lower: -887220, upper: 887220 };

export default function LiquidityForm() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const baseTokens = useMemo(() => getTokensForChain(chainId || 97) || {}, [chainId]);
  const [customTokens, setCustomTokens] = useState<Record<string, { address: Address; decimals: number }>>({});
  const tokens = useMemo(() => ({ ...baseTokens, ...customTokens }), [baseTokens, customTokens]);
  const symbols = useMemo(() => Object.keys(tokens), [tokens]);
  const nativeSym = useMemo(() => getNativeSymbol(chainId || 97) || "BNB", [chainId]);

  const [tokenASym, setTokenASym] = useState<string>(nativeSym);
  const [tokenBSym, setTokenBSym] = useState<string>(symbols.find(s => s !== nativeSym) || symbols[0] || "USDT");
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");
  const [fee, setFee] = useState<100 | 500 | 2500 | 10000>(2500);
  const [fullRange, setFullRange] = useState<boolean>(true);
  const [tickLower, setTickLower] = useState<string>(String(FULL_RANGE.lower));
  const [tickUpper, setTickUpper] = useState<string>(String(FULL_RANGE.upper));
  const [slippageBps, setSlippageBps] = useState<string>("100"); // 1%
  const [customAddr, setCustomAddr] = useState<string>("");
  const [customErr, setCustomErr] = useState<string>("");
  const [initPool, setInitPool] = useState<boolean>(false);
  const [initPrice, setInitPrice] = useState<string>(""); // token1 per token0

  const { pending, txHash, error, mint } = useV3Liquidity();
  const [quoteOk, setQuoteOk] = useState<boolean>(false);

  useEffect(() => {
    if (fullRange) {
      setTickLower(String(FULL_RANGE.lower));
      setTickUpper(String(FULL_RANGE.upper));
    }
  }, [fullRange]);

  const tokenA = (tokens as any)[tokenASym];
  const tokenB = (tokens as any)[tokenBSym];
  const wNative = useMemo(() => getWrappedNativeAddress(chainId || 97), [chainId]);
  const tokenAAddr: Address | undefined = tokenA ? ((tokenASym === nativeSym ? (wNative as Address) : (tokenA.address as Address))) : undefined;
  const tokenBAddr: Address | undefined = tokenB ? ((tokenBSym === nativeSym ? (wNative as Address) : (tokenB.address as Address))) : undefined;
  const canSubmit = !!address && !!tokenAAddr && !!tokenBAddr && tokenASym !== tokenBSym && Number(amountA) > 0 && Number(amountB) > 0 && (!fullRange ? (tickLower !== "" && tickUpper !== "") : true);

  // Auto-calc Amount B: if initializing and initPrice provided, use it; otherwise use QuoterV2 on testnet
  useEffect(() => {
    const run = async () => {
      try {
        if (!tokenA || !tokenB || !tokenAAddr || !tokenBAddr) return;
        if (!amountA || Number(amountA) <= 0) { setAmountB(""); setQuoteOk(false); return; }
        // If user provided an explicit initial price and init is enabled, respect it to keep congruence
        if (initPool && initPrice && Number(initPrice) > 0) {
          const aA = Number(amountA);
          setAmountB(String(aA * Number(initPrice)));
          setQuoteOk(true);
          return;
        }
        // Otherwise, query QuoterV2 to reflect current market ratio if available
        if (chainId === 97 && publicClient) {
          const cfg = PANCAKE_V3_97;
          const amountIn = parseUnits(amountA as `${number}` as string, tokenA.decimals);
          const out = await publicClient.readContract({
            address: cfg.quoterV2,
            abi: QUOTER_V2_ABI,
            functionName: 'quoteExactInputSingle',
            args: [{ tokenIn: tokenAAddr, tokenOut: tokenBAddr, fee, amountIn, sqrtPriceLimitX96: 0n }],
          }) as readonly [bigint, bigint, number, bigint];
          const amountOut = out[0];
          setAmountB(formatUnits(amountOut, tokenB.decimals));
          setQuoteOk(true);
          return;
        }
        setQuoteOk(false);
      } catch {
        // quote failed
        setQuoteOk(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountA, tokenAAddr, tokenBAddr, fee, initPool, initPrice, chainId]);

  async function onMint() {
    if (!canSubmit) return;
    try {
      addToast({ kind: "info", title: "Adding liquidity", message: "Submitting mint transaction" });
      const tl = parseInt(tickLower, 10);
      const tu = parseInt(tickUpper, 10);
      // If user didn't provide an initial price, infer a rough price from amounts
      let initialPriceToken1PerToken0: string | undefined = undefined;
      const aA = Number(amountA);
      const aB = Number(amountB);
      if (initPool) {
        // UI interprets price as Token B per Token A; convert to token1 per token0 according to address-sorted order
        const sortAB = tokenAAddr && tokenBAddr ? (BigInt(tokenAAddr) < BigInt(tokenBAddr)) : true;
        const uiPrice = (initPrice && Number(initPrice) > 0) ? Number(initPrice) : (aA > 0 && aB > 0 ? (aB / aA) : undefined);
        if (uiPrice && uiPrice > 0) {
          const priceSorted = sortAB ? uiPrice : (1 / uiPrice);
          initialPriceToken1PerToken0 = String(priceSorted);
        }
      }
      const p = await mint({
        token0: tokenAAddr as Address,
        token1: tokenBAddr as Address,
        fee,
        tickLower: fullRange ? FULL_RANGE.lower : tl,
        tickUpper: fullRange ? FULL_RANGE.upper : tu,
        amount0Desired: amountA,
        amount1Desired: amountB,
        amount0Decimals: tokenA.decimals,
        amount1Decimals: tokenB.decimals,
        slippageBps: Number(slippageBps || 100),
        initializePool: initPool,
        initialPriceToken1PerToken0: initialPriceToken1PerToken0,
      });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : chainId === 56 ? "https://bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Liquidity added", message: p.txHash, linkHref: base ? `${base}${p.txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      addToast({ kind: "error", title: "Add liquidity error", message: e?.shortMessage || e?.message || "Mint failed" });
    }
  }

  async function onAddCustomToken() {
    try {
      setCustomErr("");
      const addr = (customAddr || "").trim() as Address;
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        setCustomErr("Invalid address");
        return;
      }
      if (!publicClient) {
        setCustomErr("RPC client not ready");
        return;
      }
      const decimals = (await publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" })) as number;
      let sym = (await publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "TKN")) as string;
      sym = String(sym || "TKN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "TKN";
      if (sym === nativeSym) sym = `${sym}C`;
      if ((tokens as any)[sym] || customTokens[sym]) {
        let i = 1;
        while ((tokens as any)[`${sym}${i}`] || customTokens[`${sym}${i}`]) i++;
        sym = `${sym}${i}`;
      }
      setCustomTokens((m) => ({ ...m, [sym]: { address: addr, decimals } }));
      setCustomAddr("");
      addToast({ kind: "success", title: "Token added", message: `${sym} ready to use` });
    } catch (e: any) {
      setCustomErr(e?.shortMessage || e?.message || "Failed to add token");
    }
  }

  return (
    <div className="max-w-xl rounded-xl border border-zinc-800 bg-black/50 p-4">
      <h3 className="text-base font-semibold mb-3">Add Liquidity</h3>
      <div className="mb-4 rounded-lg border border-zinc-800 p-3 bg-black/40">
        <div className="text-sm font-medium mb-2">Add custom token</div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Paste ERC20 address (e.g. 0x6454... for USDC on 97)"
            value={customAddr}
            onChange={(e) => setCustomAddr(e.target.value)}
          />
          <button onClick={onAddCustomToken} className="rounded-md bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600">Add</button>
        </div>
        {customErr && <div className="mt-2 text-xs text-amber-400">{customErr}</div>}
        <div className="mt-2 text-xs text-zinc-400">Example USDC (97): 0x64544969ed7EBf5f083679233325356EbE738930</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Token A</span>
          <select className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={tokenASym} onChange={(e) => setTokenASym(e.target.value)}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Token B</span>
          <select className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={tokenBSym} onChange={(e) => setTokenBSym(e.target.value)}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Amount A</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={amountA} onChange={(e) => setAmountA(e.target.value)} placeholder="0.0" />
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Amount B</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={amountB} onChange={(e) => setAmountB(e.target.value)} placeholder="0.0" readOnly={initPool ? (initPrice.trim().length > 0) : quoteOk} />
          {!quoteOk && !(initPool && initPrice && Number(initPrice) > 0) && (
            <div className="mt-1 text-[11px] text-amber-400">No market quote available. Enter Amount B manually or enable Initialize and set an Initial price.</div>
          )}
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Fee tier</span>
          <select className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={fee} onChange={(e) => setFee(Number(e.target.value) as any)}>
            <option value={100}>0.01%</option>
            <option value={500}>0.05%</option>
            <option value={2500}>0.25%</option>
            <option value={10000}>1%</option>
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={fullRange} onChange={(e) => setFullRange(e.target.checked)} />
          <span>Full range</span>
        </label>
        {!fullRange && (
          <>
            <label className="block text-sm mb-2">
              <span className="block mb-1 text-zinc-300">Tick lower</span>
              <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={tickLower} onChange={(e) => setTickLower(e.target.value)} placeholder="-887220" />
            </label>
            <label className="block text-sm mb-2">
              <span className="block mb-1 text-zinc-300">Tick upper</span>
              <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={tickUpper} onChange={(e) => setTickUpper(e.target.value)} placeholder="887220" />
            </label>
          </>
        )}
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Slippage (bps)</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={slippageBps} onChange={(e) => setSlippageBps(e.target.value)} placeholder="100" />
        </label>
        <div className="col-span-2 mt-2 rounded-md border border-zinc-800 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={initPool} onChange={(e) => setInitPool(e.target.checked)} />
            <span>Initialize pool if needed</span>
          </label>
          {initPool && (
            <div className="mt-2">
              <div className="text-xs mb-1 text-zinc-400">Initial price (token1 per token0)</div>
              <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" value={initPrice} onChange={(e) => setInitPrice(e.target.value)} placeholder="e.g. 300 for USDC per WBNB" />
              <div className="mt-1 text-[11px] text-zinc-500">If left empty, we infer from your entered amounts.</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-400">Testnet 97 only. Uses PancakeSwap V3 PositionManager.</div>
      <button onClick={onMint} disabled={!canSubmit || pending} className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">{pending ? "Submitting…" : "Add Liquidity"}</button>
      {txHash && <div className="mt-2 text-xs text-zinc-400 break-all">Tx: {txHash}</div>}
      {error && <div className="mt-2 text-xs text-amber-400">{error}</div>}
    </div>
  );
}
