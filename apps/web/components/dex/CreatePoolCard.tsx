"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Address } from "viem";
import { getTokensForChain, getNativeSymbol, getWrappedNativeAddress } from "../../lib/tokens";
import { useV3Liquidity } from "../../hooks/useV3Liquidity";
import { useToast } from "../ui/Toast";

const FULL_RANGE = { lower: -887220, upper: 887220 };
const TICK_MIN = -887272;
const TICK_MAX = 887272;
const LN_1_0001 = Math.log(1.0001);

function tickSpacingForFee(f: 100 | 500 | 2500 | 10000) {
  switch (f) {
    case 100: return 1;
    case 500: return 10;
    case 2500: return 50;
    case 10000: return 200;
    default: return 50;
  }
}

function priceSortedNumber(tokenAAddr: Address | undefined, tokenBAddr: Address | undefined, initPriceUI: string): number | undefined {
  if (!tokenAAddr || !tokenBAddr) return undefined;
  const ui = Number(initPriceUI);
  if (!ui || ui <= 0) return undefined;
  const sortAB = (BigInt(tokenAAddr) < BigInt(tokenBAddr));
  const priceSorted = sortAB ? ui : 1 / ui;
  if (!Number.isFinite(priceSorted) || priceSorted <= 0) return undefined;
  return priceSorted;
}

function priceToTick(price: number): number {
  const tick = Math.log(price) / LN_1_0001;
  if (!Number.isFinite(tick)) return 0;
  return Math.floor(tick);
}

function alignTick(tick: number, fee: 100 | 500 | 2500 | 10000, direction: "down" | "up") {
  const spacing = tickSpacingForFee(fee);
  if (direction === "down") return Math.max(TICK_MIN, Math.floor(tick / spacing) * spacing);
  return Math.min(TICK_MAX, Math.ceil(tick / spacing) * spacing);
}

function computeAutoTicks(priceSorted: number, fee: 100 | 500 | 2500 | 10000) {
  const lowerPrice = priceSorted * 0.9;
  const upperPrice = priceSorted * 1.1;
  const tickLowerRaw = priceToTick(lowerPrice);
  const tickUpperRaw = priceToTick(upperPrice);
  const tickLowerAligned = Math.min(alignTick(tickLowerRaw, fee, "down"), alignTick(tickUpperRaw, fee, "down"));
  const tickUpperAligned = Math.max(alignTick(tickUpperRaw, fee, "up"), alignTick(tickLowerRaw, fee, "up"));
  if (tickLowerAligned >= tickUpperAligned) {
    const spacing = tickSpacingForFee(fee);
    return { lower: tickLowerAligned, upper: tickLowerAligned + spacing };
  }
  return { lower: tickLowerAligned, upper: tickUpperAligned };
}

export default function CreatePoolCard() {
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
  const [initPriceUI, setInitPriceUI] = useState<string>(""); // Token B per Token A (UI)
  const [gasWarn, setGasWarn] = useState<string>("");
  const [forceSend, setForceSend] = useState<boolean>(true);
  const [autoAdjustNote, setAutoAdjustNote] = useState<string | undefined>(undefined);

  const { pending, txHash, error, mint } = useV3Liquidity();

  const tokenA = (tokens as any)[tokenASym];
  const tokenB = (tokens as any)[tokenBSym];
  const wNative = useMemo(() => getWrappedNativeAddress(chainId || 97), [chainId]);
  const tokenAAddr: Address | undefined = tokenA ? ((tokenASym === nativeSym ? (wNative as Address) : (tokenA.address as Address))) : undefined;
  const tokenBAddr: Address | undefined = tokenB ? ((tokenBSym === nativeSym ? (wNative as Address) : (tokenB.address as Address))) : undefined;
  const canSubmit = !!address && !!tokenAAddr && !!tokenBAddr && tokenASym !== tokenBSym && Number(amountA) > 0 && Number(amountB) > 0 && Number(initPriceUI) > 0;

  // Recalculate Amount B when Amount A or price changes (congruent amounts like Pancake)
  useEffect(() => {
    const a = Number(amountA);
    const p = Number(initPriceUI);
    if (!isNaN(a) && a > 0 && !isNaN(p) && p > 0) {
      setAmountB(String(a * p));
    } else if (!amountA) {
      setAmountB("");
    }
  }, [amountA, initPriceUI]);

  useEffect(() => {
    if (fullRange) {
      setTickLower(String(FULL_RANGE.lower));
      setTickUpper(String(FULL_RANGE.upper));
    }
  }, [fullRange]);

  // Simple gas warning (best-effort)
  useEffect(() => {
    (async () => {
      try {
        setGasWarn("");
        if (!publicClient || !tokenAAddr || !tokenBAddr || !address) return;
        // Rough: init+mint often ~400k-900k on mainnets; warn if > 1.2m gas estimated
        // We don't have router here; rely on backend estimation else skip silently
        // Intentionally light to avoid blocking UX on testnet
      } catch {}
    })();
  }, [publicClient, tokenAAddr, tokenBAddr, address, fee, amountA, amountB, initPriceUI]);

  function uiPriceToToken1PerToken0(): string | undefined {
    if (!tokenAAddr || !tokenBAddr) return undefined;
    const ui = Number(initPriceUI);
    if (!ui || ui <= 0) return undefined;
    const sortAB = (BigInt(tokenAAddr) < BigInt(tokenBAddr));
    // UI is TokenB per TokenA; token1PerToken0 must follow sorted order
    const priceSorted = sortAB ? ui : (1 / ui);
    return String(priceSorted);
  }

  async function onCreate() {
    if (!canSubmit) return;
    try {
      const amountANum = Number(amountA);
      const priceUI = Number(initPriceUI);
      const priceSorted = priceSortedNumber(tokenAAddr, tokenBAddr, initPriceUI);
      const tl = parseInt(tickLower, 10);
      const tu = parseInt(tickUpper, 10);
      let effectiveLower = fullRange ? FULL_RANGE.lower : tl;
      let effectiveUpper = fullRange ? FULL_RANGE.upper : tu;
      let note: string | undefined;
      if (fullRange && amountANum > 0 && priceUI > 0 && priceSorted) {
        const notionalTokenB = amountANum * priceUI;
        const amountThreshold = 5; // token1 units heuristic
        const amountAThreshold = 0.01;
        if (notionalTokenB < amountThreshold || amountANum < amountAThreshold) {
          const autoTicks = computeAutoTicks(priceSorted, fee);
          effectiveLower = autoTicks.lower;
          effectiveUpper = autoTicks.upper;
          note = "Amounts are small, auto-adjusted range to ±10% around the initial price.";
          setFullRange(false);
          setTickLower(String(autoTicks.lower));
          setTickUpper(String(autoTicks.upper));
        }
      }
      if (note) setAutoAdjustNote(note);
      else setAutoAdjustNote(undefined);
      const p = await mint({
        token0: tokenAAddr as Address,
        token1: tokenBAddr as Address,
        fee,
        tickLower: effectiveLower,
        tickUpper: effectiveUpper,
        amount0Desired: amountA,
        amount1Desired: amountB,
        amount0Decimals: tokenA.decimals,
        amount1Decimals: tokenB.decimals,
        initializePool: true,
        initialPriceToken1PerToken0: uiPriceToToken1PerToken0(),
        forceSendOnGenericSimError: forceSend,
      });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : chainId === 56 ? "https://bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Pool created & liquidity added", message: p.txHash, linkHref: base ? `${base}${p.txHash}` : undefined, linkLabel: "View on explorer" });
      setAutoAdjustNote(undefined);
    } catch (e: any) {
      addToast({ kind: "error", title: "Create pool error", message: e?.shortMessage || e?.message || "Create failed" });
    }
  }

  return (
    <div className="max-w-xl rounded-xl border border-zinc-800 bg-gradient-to-b from-black/60 to-indigo-950/30 p-4">
      <h3 className="text-base font-semibold mb-3">Create a Pool</h3>
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
        <label className="block text-sm mb-2 col-span-2">
          <span className="block mb-1 text-zinc-300">Initial price (Token B per Token A)</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={initPriceUI} onChange={(e) => setInitPriceUI(e.target.value)} placeholder="e.g. 300 for USDC per BNB" />
          <div className="mt-1 text-[11px] text-zinc-500">We use exact math to initialize. This price must be &gt; 0.</div>
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Amount A</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={amountA} onChange={(e) => setAmountA(e.target.value)} placeholder="0.0" />
        </label>
        <label className="block text-sm mb-2">
          <span className="block mb-1 text-zinc-300">Amount B</span>
          <input className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" value={amountB} onChange={(e) => setAmountB(e.target.value)} placeholder="0.0" readOnly />
          <div className="mt-1 text-[11px] text-zinc-500">We auto-calculate Amount B from Amount A and Initial price to keep congruence.</div>
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
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <input id="forcesend" type="checkbox" checked={forceSend} onChange={(e) => setForceSend(e.target.checked)} />
        <label htmlFor="forcesend">Force send mint if estimation fails (testnet)</label>
      </div>
      {autoAdjustNote && (
        <div className="mt-1 text-xs text-sky-300">{autoAdjustNote}</div>
      )}
      {error && (
        <div className="mt-2 text-xs text-amber-400">
          {error}
        </div>
      )}
      {gasWarn && <div className="mt-2 text-xs text-amber-400">{gasWarn}</div>}
      <div className="mt-3 text-xs text-zinc-400">Testnet 97 only. Uses PancakeSwap V3 PositionManager.</div>
      <button onClick={onCreate} disabled={!canSubmit || pending} className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">{pending ? "Submitting…" : "Create Pool & Add Liquidity"}</button>
      {txHash && <div className="mt-2 text-xs text-zinc-400 break-all">Tx: {txHash}</div>}
      {error && <div className="mt-2 text-xs text-amber-400">{error}</div>}
    </div>
  );
}
