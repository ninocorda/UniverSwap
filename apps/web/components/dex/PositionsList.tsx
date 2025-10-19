"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Address, decodeEventLog, encodeEventTopics, formatUnits } from "viem";
import { useV3Liquidity } from "../../hooks/useV3Liquidity";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "../../lib/abis/NonfungiblePositionManager";
import { ERC20_ABI } from "../../lib/abis/erc20";
import { useToast } from "../ui/Toast";
import { PANCAKE_V3_97 } from "../../lib/pancakeV3";

type PositionView = {
  id: bigint;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  decimals0?: number;
  decimals1?: number;
  symbol0?: string;
  symbol1?: string;
  amount0: bigint;
  amount1: bigint;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const V3_FACTORY_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "getPool",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const V3_POOL_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "slot0",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;

const INCREASE_LIQUIDITY_EVENT = {
  type: "event",
  name: "IncreaseLiquidity",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "liquidity", type: "uint128", indexed: false },
    { name: "amount0", type: "uint256", indexed: false },
    { name: "amount1", type: "uint256", indexed: false },
  ],
} as const;

const Q96 = 1n << 96n;
const Q32 = 1n << 32n;

function shortenAddress(addr: Address | string): string {
  const s = String(addr);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function formatBigInt(value: bigint): string {
  const str = value.toString();
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTokenAmount(value: bigint, decimals?: number, symbol?: string): string {
  if (decimals === undefined) {
    return `${formatBigInt(value)}${symbol ? ` ${symbol}` : ""}`.trim();
  }
  const formatted = formatUnits(value, decimals);
  const numeric = Number(formatted);
  if (Number.isFinite(numeric) && numeric > 0 && numeric < 0.000001) {
    return `<0.000001${symbol ? ` ${symbol}` : ""}`.trim();
  }
  const [intPart, fracPart = ""] = formatted.split(".");
  const trimmedFrac = fracPart.replace(/0+$/, "").slice(0, 6);
  const display = trimmedFrac ? `${intPart}.${trimmedFrac}` : intPart;
  return `${display}${symbol ? ` ${symbol}` : ""}`.trim();
}

function getSqrtRatioAtTick(tick: number): bigint {
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;
  if (tick < MIN_TICK || tick > MAX_TICK) throw new Error("Tick out of range");

  const absTick = tick < 0 ? -tick : tick;
  let ratio = absTick & 0x1
    ? BigInt("0xfffcb933bd6fad37aa2d162d1a594001")
    : BigInt("0x100000000000000000000000000000000");
  if (absTick & 0x2) ratio = (ratio * BigInt("0xfff97272373d413259a46990580e213a")) >> 128n;
  if (absTick & 0x4) ratio = (ratio * BigInt("0xfff2e50f5f656932ef12357cf3c7fdcc")) >> 128n;
  if (absTick & 0x8) ratio = (ratio * BigInt("0xffe5caca7e10e4e61c3624eaa0941cd0")) >> 128n;
  if (absTick & 0x10) ratio = (ratio * BigInt("0xffcb9843d60f6159c9db58835c926644")) >> 128n;
  if (absTick & 0x20) ratio = (ratio * BigInt("0xff973b41fa98c081472e6896dfb254c0")) >> 128n;
  if (absTick & 0x40) ratio = (ratio * BigInt("0xff2ea16466c96a3843ec78b326b52861")) >> 128n;
  if (absTick & 0x80) ratio = (ratio * BigInt("0xfe5dee046a99a2a811c461f1969c3053")) >> 128n;
  if (absTick & 0x100) ratio = (ratio * BigInt("0xfcbe86c7900a88aedcffc83b479aa3a4")) >> 128n;
  if (absTick & 0x200) ratio = (ratio * BigInt("0xf987a7253ac413176f2b074cf7815e54")) >> 128n;
  if (absTick & 0x400) ratio = (ratio * BigInt("0xf3392b0822b70005940c7a398e4b70f3")) >> 128n;
  if (absTick & 0x800) ratio = (ratio * BigInt("0xe7159475a2c29b7443b29c7fa6e889d9")) >> 128n;
  if (absTick & 0x1000) ratio = (ratio * BigInt("0xd097f3bdfd2022b8845ad8f792aa5825")) >> 128n;
  if (absTick & 0x2000) ratio = (ratio * BigInt("0xa9f746462d870fdf8a65dc1f90e061e5")) >> 128n;
  if (absTick & 0x4000) ratio = (ratio * BigInt("0x70d869a156d2a1b890bb3df62baf32f7")) >> 128n;
  if (absTick & 0x8000) ratio = (ratio * BigInt("0x31be135f97d08fd981231505542fcfa6")) >> 128n;
  if (absTick & 0x10000) ratio = (ratio * BigInt("0x9aa508b5b7a84e1c677de54f3e99bc9")) >> 128n;
  if (absTick & 0x20000) ratio = (ratio * BigInt("0x5d6af8dedb81196699c329225ee604")) >> 128n;
  if (absTick & 0x40000) ratio = (ratio * BigInt("0x2216e584f5fa1ea926041bedfe98")) >> 128n;
  if (absTick & 0x80000) ratio = (ratio * BigInt("0x48a170391f7dc42444e8fa2")) >> 128n;

  if (tick > 0) {
    ratio = (BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / ratio);
  }

  return ((ratio >> 32n) + (ratio % Q32 === 0n ? 0n : 1n));
}

function amount0ForLiquidity(liquidity: bigint, sqrtA: bigint, sqrtB: bigint): bigint {
  let [lower, upper] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  if (lower === 0n || upper === 0n) return 0n;
  const numerator = liquidity * (upper - lower) * Q96;
  const denominator = upper * lower;
  return denominator === 0n ? 0n : numerator / denominator;
}

function amount1ForLiquidity(liquidity: bigint, sqrtA: bigint, sqrtB: bigint): bigint {
  let [lower, upper] = sqrtA > sqrtB ? [sqrtB, sqrtA] : [sqrtA, sqrtB];
  return (liquidity * (upper - lower)) / Q96;
}

function sortTokens(a: Address, b: Address): [Address, Address] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

async function fetchIncreaseLogs(
  publicClient: ReturnType<typeof usePublicClient>,
  tokenId: bigint,
): Promise<any[]> {
  if (!publicClient) return [];
  let latest: bigint = 0n;
  try {
    latest = await publicClient.getBlockNumber();
  } catch (blockErr) {
    console.warn("PositionsList: latest block fetch failed", blockErr);
    latest = 0n;
  }

  try {
    return await publicClient.getLogs({
      address: PANCAKE_V3_97.positionManager,
      event: INCREASE_LIQUIDITY_EVENT,
      args: { tokenId },
      fromBlock: 0n,
      toBlock: "latest",
    });
  } catch (directErr: any) {
    const maxSpan = 500_000n;
    const minBlock = latest > maxSpan ? latest - maxSpan : 0n;
    const logs: any[] = [];
    let chunk: bigint = 25_000n;
    if (chunk <= 0n) chunk = 1n;
    let toBlock: bigint = latest;

    while (toBlock >= minBlock) {
      let fromBlock = toBlock > chunk ? toBlock - chunk + 1n : minBlock;
      if (fromBlock < minBlock) fromBlock = minBlock;
      const rangeLabel = { fromBlock, toBlock };
      try {
        const res = await publicClient.getLogs({
          address: PANCAKE_V3_97.positionManager,
          event: INCREASE_LIQUIDITY_EVENT,
          args: { tokenId },
          fromBlock,
          toBlock: toBlock === latest ? "latest" : toBlock,
        });
        if (res.length > 0) {
          logs.unshift(...res);
        }
        if (fromBlock === minBlock) break;
        toBlock = fromBlock - 1n;
      } catch (err: any) {
        const parts = [err?.shortMessage, err?.details, err?.message]
          .filter(Boolean)
          .map((p: any) => String(p).toLowerCase())
          .join(" ");
        if (chunk > 1n && (parts.includes("defined limit") || parts.includes("limit exceeded"))) {
          chunk = chunk / 2n;
          if (chunk === 0n) chunk = 1n;
          continue;
        }
        console.warn("PositionsList: chunk log fetch failed", rangeLabel, err);
        if (fromBlock === minBlock || chunk === 1n) {
          break;
        }
        toBlock = fromBlock - 1n;
      }
    }

    return logs;
  }
}

async function readPoolAddress(
  publicClient: ReturnType<typeof usePublicClient>,
  cache: Map<string, Address | null>,
  positionManager: Address,
  factoryRef: React.MutableRefObject<Address | null>,
  token0: Address,
  token1: Address,
  fee: number,
): Promise<Address | undefined> {
  if (!publicClient) return undefined;
  const [tokenA, tokenB] = sortTokens(token0, token1);
  const key = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}-${fee}`;
  if (cache.has(key)) {
    const cached = cache.get(key);
    return cached ?? undefined;
  }
  try {
    if (!factoryRef.current) {
      try {
        const dynamicFactory = await publicClient.readContract({
          address: positionManager,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: "factory",
        });
        factoryRef.current = dynamicFactory as Address;
      } catch (factoryErr) {
        console.warn("PositionsList: unable to read factory from position manager", factoryErr);
        factoryRef.current = PANCAKE_V3_97.factory;
      }
    }
    const factoryAddress = factoryRef.current ?? PANCAKE_V3_97.factory;
    const pool = await publicClient.readContract({
      address: factoryAddress,
      abi: V3_FACTORY_ABI,
      functionName: "getPool",
      args: [tokenA, tokenB, fee],
    });
    const resolved = pool && pool !== ZERO_ADDRESS ? (pool as Address) : null;
    cache.set(key, resolved);
    return resolved ?? undefined;
  } catch (e) {
    console.warn("PositionsList: getPool failed", e);
    cache.set(key, null);
    return undefined;
  }
}

export default function PositionsList() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const { listPositions, increase, decrease, collect, pending, txHash, error, recentTokenIds } = useV3Liquidity();

  const [positions, setPositions] = useState<PositionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [pmWarning, setPmWarning] = useState<string>("");
  const [increaseInputs, setIncreaseInputs] = useState<Record<string, { a0: string; a1: string }>>({});
  const [decreasePct, setDecreasePct] = useState<Record<string, string>>({});
  const [cachedTokenIds, setCachedTokenIds] = useState<bigint[]>([]);
  const [expandedId, setExpandedId] = useState<bigint | null>(null);
  const [localDeposits, setLocalDeposits] = useState<Record<string, { amount0: bigint; amount1: bigint }>>({});
  const poolCache = useMemo(() => new Map<string, Address | null>(), []);
  const factoryRef = useRef<Address | null>(null);
  const depositedCache = useMemo(() => new Map<string, { amount0: bigint; amount1: bigint }>(), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !address) return;
    const key = `v3-positions-${address.toLowerCase()}`;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setCachedTokenIds(parsed.map((s) => BigInt(s)));
      }
    } catch {}

    function onUpdate(e: Event) {
      if (!address) return;
      const ev = e as CustomEvent<{ address: string; tokenIds: string[] }>;
      if (!ev.detail || ev.detail.address !== address.toLowerCase()) return;
      setCachedTokenIds(ev.detail.tokenIds.map((s) => BigInt(s)));
    }

    window.addEventListener('v3-positions-updated', onUpdate as EventListener);
    return () => window.removeEventListener('v3-positions-updated', onUpdate as EventListener);
  }, [address]);

  useEffect(() => {
    if (!address || typeof window === 'undefined') {
      setLocalDeposits({});
      return;
    }
    const key = `v3-deposits-${address.toLowerCase()}`;

    const readDeposits = () => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          setLocalDeposits({});
          return;
        }
        const parsed = JSON.parse(raw) as Record<string, { amount0: string; amount1: string }>;
        if (!parsed || typeof parsed !== "object") {
          setLocalDeposits({});
          return;
        }
        const converted: Record<string, { amount0: bigint; amount1: bigint }> = {};
        for (const [tokenId, value] of Object.entries(parsed)) {
          try {
            const a0 = value?.amount0 ? BigInt(value.amount0) : 0n;
            const a1 = value?.amount1 ? BigInt(value.amount1) : 0n;
            converted[tokenId] = { amount0: a0, amount1: a1 };
          } catch {
            // skip malformed entry
          }
        }
        setLocalDeposits(converted);
      } catch (err) {
        console.warn("PositionsList: unable to parse local deposits", err);
        setLocalDeposits({});
      }
    };

    readDeposits();
    const onUpdate = (event: Event) => {
      const ev = event as CustomEvent<{ address: string; deposits: Record<string, { amount0: string; amount1: string }> }>;
      if (!ev.detail || ev.detail.address !== address.toLowerCase()) return;
      const next: Record<string, { amount0: bigint; amount1: bigint }> = {};
      for (const [tokenId, val] of Object.entries(ev.detail.deposits || {})) {
        try {
          next[tokenId] = {
            amount0: val?.amount0 ? BigInt(val.amount0) : 0n,
            amount1: val?.amount1 ? BigInt(val.amount1) : 0n,
          };
        } catch {
          // ignore conversion errors
        }
      }
      setLocalDeposits(next);
    };

    window.addEventListener('v3-deposits-updated', onUpdate as EventListener);
    return () => window.removeEventListener('v3-deposits-updated', onUpdate as EventListener);
  }, [address]);

  useEffect(() => {
    for (const [tokenId, entry] of Object.entries(localDeposits)) {
      depositedCache.set(tokenId, { amount0: entry.amount0, amount1: entry.amount1 });
    }
  }, [localDeposits, depositedCache]);

  useEffect(() => {
    async function load() {
      if (!address || chainId !== 97) return;
      if (pending) return;
      setLoading(true);
      try {
        const ids = await listPositions(address as Address);
        const unionIds = new Set<bigint>(ids);
        for (const extra of recentTokenIds) unionIds.add(extra);
        for (const cached of cachedTokenIds) unionIds.add(cached);
        const pmAddr = chainId === 97 ? PANCAKE_V3_97.positionManager : undefined;
        if (unionIds.size === 0 && publicClient && pmAddr) {
          try {
            const count = (await publicClient.readContract({
              address: pmAddr,
              abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
              functionName: "balanceOf",
              args: [address as Address],
            })) as bigint;
            const total = Number(count);
            for (let i = 0; i < total; i++) {
              const id = (await publicClient.readContract({
                address: pmAddr,
                abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
                functionName: "tokenOfOwnerByIndex",
                args: [address as Address, BigInt(i)],
              })) as bigint;
              unionIds.add(id);
            }
          } catch (fallbackErr) {
            console.warn("Positions fallback enumeration failed", fallbackErr);
          }
        }
        const items: PositionView[] = [];
        for (const id of unionIds) {
          if (!publicClient || !pmAddr) continue;
          let p: any;
          try {
            p = await publicClient.readContract({
              address: pmAddr,
              abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
              functionName: "positions",
              args: [id],
            });
          } catch (positionErr) {
            console.warn("Failed to fetch position", id, positionErr);
            continue;
          }
          const isTuple = Array.isArray(p);
          const token0Addr = (isTuple ? p[2] : p?.token0) as Address | undefined;
          const token1Addr = (isTuple ? p[3] : p?.token1) as Address | undefined;
          const feeRaw = isTuple ? p[4] : p?.fee;
          const tickLowerRaw = isTuple ? p[5] : p?.tickLower;
          const tickUpperRaw = isTuple ? p[6] : p?.tickUpper;
          const liquidityRaw = isTuple ? p[7] : p?.liquidity;
          const tokensOwed0Raw = isTuple ? p[10] : p?.tokensOwed0;
          const tokensOwed1Raw = isTuple ? p[11] : p?.tokensOwed1;

          if (!token0Addr || !token1Addr || typeof feeRaw === "undefined" || typeof tickLowerRaw === "undefined" || typeof tickUpperRaw === "undefined") {
            console.warn("PositionsList: missing fields in position", id, p);
            continue;
          }
          const liquidity = typeof liquidityRaw === "bigint" ? liquidityRaw : liquidityRaw ? BigInt(liquidityRaw) : 0n;
          const tokensOwed0 = typeof tokensOwed0Raw === "bigint" ? tokensOwed0Raw : tokensOwed0Raw ? BigInt(tokensOwed0Raw) : 0n;
          const tokensOwed1 = typeof tokensOwed1Raw === "bigint" ? tokensOwed1Raw : tokensOwed1Raw ? BigInt(tokensOwed1Raw) : 0n;
          // fetch decimals
          let d0: number | undefined;
          let d1: number | undefined;
          let s0: string | undefined;
          let s1: string | undefined;
          let amount0 = 0n;
          let amount1 = 0n;
          try {
            d0 = await publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }) as number;
            d1 = await publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }) as number;
          } catch {}
          try {
            s0 = await publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }) as string;
          } catch {}
          try {
            s1 = await publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }) as string;
          } catch {}
          try {
            const cacheKey = `${id.toString()}`;
            if (depositedCache.has(cacheKey)) {
              const cached = depositedCache.get(cacheKey)!;
              amount0 = cached.amount0;
              amount1 = cached.amount1;
            } else {
              try {
                const logs = await fetchIncreaseLogs(publicClient, id);
                let total0 = 0n;
                let total1 = 0n;
                for (const log of logs) {
                  try {
                    const decoded = decodeEventLog({ abi: [INCREASE_LIQUIDITY_EVENT], data: log.data, topics: log.topics });
                    if (decoded.eventName !== "IncreaseLiquidity") continue;
                    const args = decoded.args as any;
                    total0 += typeof args.amount0 === "bigint" ? args.amount0 : BigInt(args.amount0);
                    total1 += typeof args.amount1 === "bigint" ? args.amount1 : BigInt(args.amount1);
                  } catch {}
                }
                amount0 = total0;
                amount1 = total1;
              } catch (logErr) {
                console.warn("PositionsList: log fetch failed", logErr);
              }

              if (amount0 === 0n && amount1 === 0n && liquidity > 0n) {
                try {
                  const poolAddr = await readPoolAddress(publicClient, poolCache, PANCAKE_V3_97.positionManager, factoryRef, token0Addr, token1Addr, Number(feeRaw));
                  if (poolAddr) {
                    const slot0 = await publicClient.readContract({ address: poolAddr, abi: V3_POOL_ABI, functionName: "slot0" }) as any;
                    const sqrtPriceX96 = (slot0?.sqrtPriceX96 ?? (Array.isArray(slot0) ? slot0[0] : undefined)) as bigint | undefined;
                    if (sqrtPriceX96) {
                      const sqrtLower = getSqrtRatioAtTick(Number(tickLowerRaw));
                      const sqrtUpper = getSqrtRatioAtTick(Number(tickUpperRaw));
                      if (sqrtPriceX96 <= sqrtLower) {
                        amount0 = amount0ForLiquidity(liquidity, sqrtLower, sqrtUpper);
                        amount1 = 0n;
                      } else if (sqrtPriceX96 >= sqrtUpper) {
                        amount0 = 0n;
                        amount1 = amount1ForLiquidity(liquidity, sqrtLower, sqrtUpper);
                      } else {
                        amount0 = amount0ForLiquidity(liquidity, sqrtPriceX96, sqrtUpper);
                        amount1 = amount1ForLiquidity(liquidity, sqrtLower, sqrtPriceX96);
                      }
                    }
                  }
                } catch (mathErr) {
                  console.warn("PositionsList: fallback amount calc failed", mathErr);
                }
              }

              console.log("PositionsList deposited calc", {
                tokenId: id.toString(),
                liquidity: liquidity.toString(),
                amount0: amount0.toString(),
                amount1: amount1.toString(),
              });

              depositedCache.set(cacheKey, { amount0, amount1 });
            }
          } catch (fetchErr) {
            console.warn("PositionsList: unable to fetch deposited amounts", fetchErr);
          }
          items.push({
            id,
            token0: token0Addr,
            token1: token1Addr,
            fee: Number(feeRaw),
            tickLower: Number(tickLowerRaw),
            tickUpper: Number(tickUpperRaw),
            liquidity,
            tokensOwed0,
            tokensOwed1,
            decimals0: d0,
            decimals1: d1,
            symbol0: s0,
            symbol1: s1,
            amount0,
            amount1,
          });
        }
        setPositions(items);
        setPmWarning("");
      } catch (e: any) {
        // Show a friendly message if PM is not deployed or wrong address
        setPmWarning(e?.message || "Unable to load positions. Check PositionManager address for testnet.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address, chainId, pending, txHash, recentTokenIds, cachedTokenIds, publicClient, localDeposits]);

  useEffect(() => {
    if (!txHash) return;
    const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : chainId === 56 ? "https://bscscan.com/tx/" : undefined;
    addToast({ kind: "info", title: "Transaction submitted", message: txHash, linkHref: base ? `${base}${txHash}` : undefined, linkLabel: "View on explorer" });
  }, [txHash]);

  async function onIncrease(pos: PositionView) {
    try {
      const key = String(pos.id);
      const vals = increaseInputs[key] || { a0: "", a1: "" };
      if (!vals.a0 && !vals.a1) return;
      const r = await increase({
        tokenId: pos.id,
        amount0Desired: vals.a0 || "0",
        amount1Desired: vals.a1 || "0",
        amount0Decimals: pos.decimals0 || 18,
        amount1Decimals: pos.decimals1 || 18,
        slippageBps: 100,
      });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Liquidity increased", message: r.txHash, linkHref: base ? `${base}${r.txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      addToast({ kind: "error", title: "Increase error", message: e?.shortMessage || e?.message || "Failed" });
    }
  }

  async function onDecrease(pos: PositionView) {
    try {
      const pctStr = decreasePct[String(pos.id)] || "";
      const pct = Number(pctStr);
      if (!(pct > 0 && pct <= 100)) return;
      const burn = (pos.liquidity * BigInt(Math.floor(pct * 100))) / 10000n; // pct with 2 decimals
      const r = await decrease({ tokenId: pos.id, liquidity: burn, amount0Min: 0n, amount1Min: 0n });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Liquidity decreased", message: r.txHash, linkHref: base ? `${base}${r.txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      addToast({ kind: "error", title: "Decrease error", message: e?.shortMessage || e?.message || "Failed" });
    }
  }

  async function onRemove(pos: PositionView) {
    try {
      if (pos.liquidity === 0n) return;
      const r = await decrease({ tokenId: pos.id, liquidity: pos.liquidity, amount0Min: 0n, amount1Min: 0n });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Liquidity removed", message: r.txHash, linkHref: base ? `${base}${r.txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      addToast({ kind: "error", title: "Remove error", message: e?.shortMessage || e?.message || "Failed" });
    }
  }

  async function onCollect(pos: PositionView) {
    try {
      const r = await collect({ tokenId: pos.id, recipient: address as Address });
      const base = chainId === 97 ? "https://testnet.bscscan.com/tx/" : undefined;
      addToast({ kind: "success", title: "Fees collected", message: r.txHash, linkHref: base ? `${base}${r.txHash}` : undefined, linkLabel: "View on explorer" });
    } catch (e: any) {
      addToast({ kind: "error", title: "Collect error", message: e?.shortMessage || e?.message || "Failed" });
    }
  }

  return (
    <div className="max-w-2xl rounded-xl border border-zinc-800 bg-black/50 p-4">
      <h3 className="text-base font-semibold mb-3">Your Positions</h3>
      {!address ? (
        <div className="text-sm text-zinc-400">Connect your wallet to view positions.</div>
      ) : loading ? (
        <div className="text-sm text-zinc-400">Loading positions…</div>
      ) : positions.length === 0 ? (
        <div className="text-sm text-zinc-400">No positions found yet on this network.</div>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => {
            const isOpen = expandedId === p.id;
            const pairLabel = `${p.symbol0 ?? shortenAddress(p.token0)}/${p.symbol1 ?? shortenAddress(p.token1)}`;
            const feePct = (p.fee / 10000).toFixed(2);
            const liquidityLabel = formatBigInt(p.liquidity);
            const feesLabel = `${formatTokenAmount(p.tokensOwed0, p.decimals0, p.symbol0)} · ${formatTokenAmount(p.tokensOwed1, p.decimals1, p.symbol1)}`;
            const depositedLabel = `${formatTokenAmount(p.amount0, p.decimals0, p.symbol0)} + ${formatTokenAmount(p.amount1, p.decimals1, p.symbol1)}`;
            return (
              <div key={String(p.id)} className="rounded-xl border border-white/10 bg-zinc-950/80">
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === p.id ? null : p.id))}
                  className="flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 text-sm">
                      <span className="font-medium text-white">{pairLabel}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">#{String(p.id)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 text-xs text-zinc-400">
                      <span>Deposited · {depositedLabel}</span>
                      <span>Fee tier · {feePct}%</span>
                      <span>Uncollected · {feesLabel}</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{isOpen ? "Hide" : "Manage"}</div>
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-white/10 px-4 py-4 text-sm">
                    <div className="grid gap-3 text-xs text-zinc-400 sm:grid-cols-2">
                      <div>
                        <div className="font-medium text-zinc-200">Token addresses</div>
                        <div className="mt-1 break-all">{shortenAddress(p.token0)} · {shortenAddress(p.token1)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200">Tick range</div>
                        <div className="mt-1">{p.tickLower} → {p.tickUpper}</div>
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200">Uncollected fees</div>
                        <div className="mt-1">{feesLabel}</div>
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200">Virtual liquidity</div>
                        <div className="mt-1 font-mono text-white/80">{liquidityLabel}</div>
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200">Deposited amounts</div>
                        <div className="mt-1">{depositedLabel}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                        <div className="text-xs font-medium text-zinc-300">Increase liquidity</div>
                        <div className="mt-2 space-y-2">
                          <input
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                            placeholder={`amount0 (${p.decimals0 ?? 18}d)`}
                            value={increaseInputs[String(p.id)]?.a0 || ""}
                            onChange={(e) =>
                              setIncreaseInputs((m) => ({
                                ...m,
                                [String(p.id)]: { a0: e.target.value, a1: m[String(p.id)]?.a1 || "" },
                              }))
                            }
                          />
                          <input
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                            placeholder={`amount1 (${p.decimals1 ?? 18}d)`}
                            value={increaseInputs[String(p.id)]?.a1 || ""}
                            onChange={(e) =>
                              setIncreaseInputs((m) => ({
                                ...m,
                                [String(p.id)]: { a0: m[String(p.id)]?.a0 || "", a1: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <button
                          onClick={() => onIncrease(p)}
                          disabled={pending}
                          className="mt-3 w-full rounded bg-indigo-600 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {pending ? "Submitting…" : "Increase"}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                          <div className="text-xs font-medium text-zinc-300">Decrease liquidity</div>
                          <input
                            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                            placeholder="Percentage e.g. 25"
                            value={decreasePct[String(p.id)] || ""}
                            onChange={(e) => setDecreasePct((m) => ({ ...m, [String(p.id)]: e.target.value }))}
                          />
                          <button
                            onClick={() => onDecrease(p)}
                            disabled={pending}
                            className="mt-2 w-full rounded bg-rose-600 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            {pending ? "Submitting…" : "Decrease"}
                          </button>
                        </div>

                        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3 text-xs font-medium text-white">
                          <button
                            onClick={() => onCollect(p)}
                            disabled={pending}
                            className="w-full rounded bg-emerald-600 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {pending ? "Submitting…" : "Collect fees"}
                          </button>
                          <button
                            onClick={() => onRemove(p)}
                            disabled={pending || p.liquidity === 0n}
                            className="w-full rounded bg-zinc-800 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
                          >
                            {pending ? "Submitting…" : "Remove position"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 text-xs text-zinc-500">Network: {chainId}</div>
      {pmWarning && <div className="mt-2 text-xs text-amber-400">{pmWarning}</div>}
      {error && <div className="mt-2 text-xs text-amber-400">{error}</div>}
    </div>
  );
}

