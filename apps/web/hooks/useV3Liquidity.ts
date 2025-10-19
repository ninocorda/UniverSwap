"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, Hex, parseUnits, formatUnits, encodeEventTopics, decodeEventLog } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { PANCAKE_V3_97 } from "../lib/pancakeV3";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "../lib/abis/NonfungiblePositionManager";
import { ERC20_ABI } from "../lib/abis/erc20";

const WETH_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;

const MAX_UINT128 = BigInt("0xffffffffffffffffffffffffffffffff");
const Q192 = 1n << 192n;
const LN_1_0001 = Math.log(1.0001);

const V3_POOL_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

function toBigInt(value: any): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value) return BigInt(value);
  if (value && typeof value === "object" && "toString" in value) {
    try {
      return BigInt(value.toString());
    } catch {}
  }
  return 0n;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type IncreaseEvent = { tokenId: bigint; amount0: bigint; amount1: bigint };

function extractIncreaseEvents(logs: readonly { data: Hex; topics: readonly Hex[] }[]): IncreaseEvent[] {
  const events: IncreaseEvent[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: NONFUNGIBLE_POSITION_MANAGER_ABI, data: log.data, topics: log.topics, strict: false });
      if (decoded.eventName !== 'IncreaseLiquidity') continue;
      const args = decoded.args as any;
      const tokenId = toBigInt(args?.tokenId);
      const amount0 = toBigInt(args?.amount0);
      const amount1 = toBigInt(args?.amount1);
      events.push({ tokenId, amount0, amount1 });
    } catch {}
  }
  return events;
}

export type MintParams = {
  token0: Address;
  token1: Address;
  fee: 100 | 500 | 2500 | 10000;
  tickLower: number; // int24
  tickUpper: number; // int24
  amount0Desired: string; // decimal string
  amount1Desired: string; // decimal string
  amount0Decimals: number;
  amount1Decimals: number;
  slippageBps?: number; // for min amounts calc
  initializePool?: boolean; // optionally create & init pool if missing
  initialPriceToken1PerToken0?: string; // optional decimal price to init pool
  forceSendOnGenericSimError?: boolean; // if true, send tx even if simulation returns a generic 0x/unpredictable error
};

export type IncreaseParams = {
  tokenId: bigint;
  amount0Desired: string;
  amount1Desired: string;
  amount0Decimals: number;
  amount1Decimals: number;
  slippageBps?: number;
};

export type DecreaseParams = {
  tokenId: bigint;
  liquidity: bigint; // amount of liquidity to burn
  amount0Min?: bigint;
  amount1Min?: bigint;
};

export type CollectParams = {
  tokenId: bigint;
  recipient: Address;
  amount0Max?: bigint; // defaults to max uint128 in function
  amount1Max?: bigint;
};

export function useV3Liquidity() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [pending, setPending] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [recentTokenIds, setRecentTokenIds] = useState<bigint[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).publicClient = publicClient;
    (window as any).NONFUNGIBLE_POSITION_MANAGER_ABI = NONFUNGIBLE_POSITION_MANAGER_ABI;
  }, [publicClient]);

  // Tick helpers
  const TICK_MIN = -887272;
  const TICK_MAX = 887272;
  function tickSpacingForFee(fee: 100 | 500 | 2500 | 10000): number {
    switch (fee) {
      case 100: return 1;
      case 500: return 10;
      case 2500: return 50;
      case 10000: return 200;
      default: return 50;
    }
  }
  function alignTicks(fee: 100 | 500 | 2500 | 10000, lower: number, upper: number): { lower: number; upper: number } {
    const spacing = tickSpacingForFee(fee);
    let lo = Math.max(TICK_MIN, Math.min(lower, upper));
    let hi = Math.min(TICK_MAX, Math.max(lower, upper));
    // round to multiples of spacing
    lo = Math.floor(lo / spacing) * spacing;
    hi = Math.ceil(hi / spacing) * spacing;
    if (lo >= hi) hi = lo + spacing; // ensure valid
    return { lower: lo, upper: hi };
  }

  const cfg = useMemo(() => (chainId === 97 ? PANCAKE_V3_97 : undefined), [chainId]);

  // Minimal ABI for Pancake/Uniswap V3 factory getPool(address,address,uint24) -> address
  const V3_FACTORY_ABI = [
    {
      type: 'function',
      name: 'getPool',
      stateMutability: 'view',
      inputs: [
        { name: 'tokenA', type: 'address' },
        { name: 'tokenB', type: 'address' },
        { name: 'fee', type: 'uint24' },
      ],
      outputs: [{ name: 'pool', type: 'address' }],
    },
  ] as const;

  // Precise math helpers (encodeSqrtRatioX96)
  function bigintSqrt(n: bigint): bigint {
    if (n < 0n) throw new Error('sqrt of negative');
    if (n < 2n) return n;
    // Newton's method
    let x0 = n;
    let x1 = (n >> 1n) + 1n;
    while (x1 < x0) {
      x0 = x1;
      x1 = (x1 + n / x1) >> 1n;
    }
    return x0;
  }

  function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
    // sqrt((amount1/amount0)) * 2^96 -> sqrt((amount1 << 192) / amount0)
    if (amount0 === 0n) throw new Error('amount0 is zero');
    const Q192 = 1n << 192n;
    const ratio = (amount1 * Q192) / amount0;
    return bigintSqrt(ratio);
  }

  function priceToSqrtX96Token1PerToken0(priceStr: string, dec0: number, dec1: number): bigint {
    // Convert decimal string to fraction num/den, then build amount1/amount0 with decimals
    const s = priceStr.trim();
    if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('invalid price');
    const [w, f = ''] = s.split('.');
    const fracLen = BigInt(f.length);
    const num = BigInt(w + f); // price * 10^fracLen
    const den = 10n ** fracLen;
    // Build integer amounts with token decimals so that price = (a1/10^d1) / (a0/10^d0) = num/den
    const a1 = num * (10n ** BigInt(dec1));
    const a0 = den * (10n ** BigInt(dec0));
    return encodeSqrtRatioX96(a1, a0);
  }

  const approveIfNeeded = useCallback(
    async (token: Address, owner: Address, spender: Address, amount: bigint) => {
      if (!publicClient || !walletClient) throw new Error("Wallet not ready");
      const allowance = (await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, spender] })) as bigint;
      if (allowance >= amount) return null;
      const hash = await walletClient.writeContract({ address: token, abi: ERC20_ABI, functionName: "approve", args: [spender, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")] });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [publicClient, walletClient]
  );

  const getPoolPriceRatio = useCallback(
    async (token0: Address, token1: Address, fee: number) => {
      if (!publicClient || !cfg) return null;
      try {
        const pool = (await publicClient.readContract({
          address: cfg.factory,
          abi: V3_FACTORY_ABI,
          functionName: 'getPool',
          args: [token0, token1, fee],
        })) as Address;
        if (!pool || pool.toLowerCase() === ZERO_ADDRESS) return null;
        const slot0 = await publicClient.readContract({
          address: pool,
          abi: V3_POOL_ABI,
          functionName: 'slot0',
        }) as any;
        const sqrtPriceX96 = toBigInt(Array.isArray(slot0) ? slot0[0] : slot0?.sqrtPriceX96);
        if (sqrtPriceX96 <= 0n) return null;
        const priceNum = sqrtPriceX96 * sqrtPriceX96;
        return { priceNum, priceDen: Q192 } as const;
      } catch (err) {
        console.warn('useV3Liquidity: unable to read pool price', err);
        return null;
      }
    },
    [cfg, publicClient]
  );

  const getWbnbBalance = useCallback(async () => {
    if (!publicClient || !address || !cfg) return 0n;
    return (await publicClient.readContract({ address: cfg.wbnb, abi: ERC20_ABI, functionName: "balanceOf", args: [address as Address] })) as bigint;
  }, [address, cfg, publicClient]);

  const wrapWbnbIfNeeded = useCallback(
    async (required: bigint) => {
      if (!publicClient || !walletClient || !address || !cfg) throw new Error("Wallet not connected");
      if (required <= 0n) return;
      const current = await getWbnbBalance();
      const missing = required > current ? required - current : 0n;
      if (missing === 0n) return;
      const tx = await walletClient.writeContract({
        address: cfg.wbnb,
        abi: WETH_ABI,
        functionName: "deposit",
        args: [],
        account: address as Address,
        chain: walletClient.chain,
        value: missing,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== 'success') {
        throw new Error("Wrapping BNB into WBNB failed");
      }
    },
    [address, cfg, getWbnbBalance, publicClient, walletClient]
  );

  const unwrapWbnbAmount = useCallback(
    async (amount: bigint) => {
      if (!publicClient || !walletClient || !address || !cfg) throw new Error("Wallet not connected");
      if (amount <= 0n) return;
      const tx = await walletClient.writeContract({
        address: cfg.wbnb,
        abi: WETH_ABI,
        functionName: "withdraw",
        args: [amount],
        account: address as Address,
        chain: walletClient.chain,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== 'success') {
        throw new Error("Unwrapping WBNB failed");
      }
    },
    [address, cfg, publicClient, walletClient]
  );

  const depositsKey = useMemo(() => (address ? `v3-deposits-${address.toLowerCase()}` : undefined), [address]);

  const readDepositsFromStorage = useCallback((): Record<string, { amount0: string; amount1: string }> => {
    if (!depositsKey || typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(depositsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, { amount0: string; amount1: string }>;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch (err) {
      console.warn("useV3Liquidity: unable to parse deposits cache", err);
      return {};
    }
  }, [depositsKey]);

  const writeDepositsToStorage = useCallback(
    (value: Record<string, { amount0: string; amount1: string }>) => {
      if (!depositsKey || typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(depositsKey, JSON.stringify(value));
        if (address) {
          window.dispatchEvent(
            new CustomEvent('v3-deposits-updated', {
              detail: {
                address: address.toLowerCase(),
                deposits: value,
              },
            }),
          );
        }
      } catch (err) {
        console.warn("useV3Liquidity: unable to persist deposits", err);
      }
    },
    [address, depositsKey]
  );

  const recordDepositedAmounts = useCallback(
    (tokenId: bigint, delta0: bigint, delta1: bigint) => {
      if (delta0 === 0n && delta1 === 0n) return;
      const current = readDepositsFromStorage();
      const key = tokenId.toString();
      const prev = current[key] ?? { amount0: '0', amount1: '0' };
      const next0 = BigInt(prev.amount0 || '0') + (delta0 >= 0n ? delta0 : 0n);
      const next1 = BigInt(prev.amount1 || '0') + (delta1 >= 0n ? delta1 : 0n);
      current[key] = { amount0: next0.toString(), amount1: next1.toString() };
      writeDepositsToStorage(current);
    },
    [readDepositsFromStorage, writeDepositsToStorage]
  );

  const clearDepositedAmounts = useCallback(
    (tokenId: bigint) => {
      const current = readDepositsFromStorage();
      const key = tokenId.toString();
      if (!(key in current)) return;
      delete current[key];
      writeDepositsToStorage(current);
    },
    [readDepositsFromStorage, writeDepositsToStorage]
  );

  const removePositionFromCache = useCallback(
    (tokenId: bigint) => {
      clearDepositedAmounts(tokenId);
      setRecentTokenIds((prev) => prev.filter((id) => id !== tokenId));
      if (typeof window === 'undefined' || !address) return;
      const key = `v3-positions-${address.toLowerCase()}`;
      try {
        const existingRaw = window.localStorage.getItem(key);
        if (!existingRaw) {
          window.dispatchEvent(new CustomEvent('v3-positions-updated', { detail: { address: address.toLowerCase(), tokenIds: [] } }));
          return;
        }
        const existing: string[] = JSON.parse(existingRaw);
        const filtered = existing.filter((id) => id !== tokenId.toString());
        window.localStorage.setItem(key, JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('v3-positions-updated', { detail: { address: address.toLowerCase(), tokenIds: filtered } }));
      } catch {}
    },
    [address, clearDepositedAmounts]
  );

  const collectPosition = useCallback(
    async (tokenId: bigint, recipient: Address, amount0Max?: bigint, amount1Max?: bigint) => {
      if (!publicClient || !walletClient || !address || !cfg) throw new Error("Wallet not connected");
      const beforeWbnb = await getWbnbBalance();
      const tx = await walletClient.writeContract({
        address: cfg.positionManager,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "collect",
        args: [
          {
            tokenId,
            recipient,
            amount0Max: amount0Max ?? MAX_UINT128,
            amount1Max: amount1Max ?? MAX_UINT128,
          },
        ],
        chain: walletClient.chain,
        account: address as Address,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const afterWbnb = await getWbnbBalance();
      const gained = afterWbnb > beforeWbnb ? afterWbnb - beforeWbnb : 0n;
      if (gained > 0n) {
        try {
          await unwrapWbnbAmount(gained);
        } catch (unwrapErr) {
          console.warn("useV3Liquidity: unwrap after collect failed", unwrapErr);
          const msg = (unwrapErr as any)?.shortMessage || (unwrapErr as Error)?.message || "Unable to unwrap WBNB";
          setError(msg);
          throw unwrapErr;
        }
      }
      return { txHash: tx as Hex, receipt };
    },
    [address, cfg, getWbnbBalance, publicClient, setError, walletClient, unwrapWbnbAmount]
  );

  const maybeBurnPosition = useCallback(
    async (tokenId: bigint) => {
      if (!publicClient || !walletClient || !address || !cfg) return;
      try {
        const raw = await publicClient.readContract({
          address: cfg.positionManager,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: "positions",
          args: [tokenId],
        }) as any;
        const liquidity = toBigInt(Array.isArray(raw) ? raw[7] : raw?.liquidity);
        const owed0 = toBigInt(Array.isArray(raw) ? raw[10] : raw?.tokensOwed0);
        const owed1 = toBigInt(Array.isArray(raw) ? raw[11] : raw?.tokensOwed1);
        if (liquidity === 0n && owed0 === 0n && owed1 === 0n) {
          try {
            const burnTx = await walletClient.writeContract({
              address: cfg.positionManager,
              abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
              functionName: "burn",
              args: [tokenId],
              chain: walletClient.chain,
              account: address as Address,
            });
            await publicClient.waitForTransactionReceipt({ hash: burnTx });
            removePositionFromCache(tokenId);
          } catch (burnErr) {
            console.warn("useV3Liquidity: burn failed", burnErr);
          }
        }
      } catch (posErr) {
        console.warn("useV3Liquidity: unable to read position for burn", posErr);
      }
    },
    [address, cfg, publicClient, walletClient, removePositionFromCache]
  );

  const mint = useCallback(
    async (p: MintParams) => {
      try {
        if (!publicClient || !walletClient || !address) throw new Error("Wallet not connected");
        if (chainId !== 97) throw new Error("This action is enabled for testnet 97 only");
        if (!cfg) throw new Error("Pancake V3 config missing for this chain");

        setPending(true); setError(undefined); setTxHash(undefined);
        const to = address as Address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

        // sort tokens for V3 (token0 < token1) and align amounts accordingly
        const sortAB = (BigInt(p.token0) < BigInt(p.token1));
        const token0Sorted = sortAB ? p.token0 : p.token1;
        const token1Sorted = sortAB ? p.token1 : p.token0;
        const amountAWei = parseUnits(p.amount0Desired as `${number}` as string, p.amount0Decimals);
        const amountBWei = parseUnits(p.amount1Desired as `${number}` as string, p.amount1Decimals);
        let amount0DesiredWei = sortAB ? amountAWei : amountBWei;
        let amount1DesiredWei = sortAB ? amountBWei : amountAWei;
        const decimals0Sorted = sortAB ? p.amount0Decimals : p.amount1Decimals;
        const decimals1Sorted = sortAB ? p.amount1Decimals : p.amount0Decimals;
        // Determine if one side is wrapped native (WBNB) and send native value to wrap automatically
        const wbnb = cfg.wbnb.toLowerCase();
        const token0IsWbnb = token0Sorted.toLowerCase() === wbnb;
        const token1IsWbnb = token1Sorted.toLowerCase() === wbnb;
        let simulatedAmount0Used: bigint | undefined;
        let simulatedAmount1Used: bigint | undefined;
        let wbnbBalanceBeforeMint: bigint | null = null;

        let priceRatio = (token0IsWbnb || token1IsWbnb)
          ? await getPoolPriceRatio(token0Sorted, token1Sorted, p.fee)
          : null;

        if (!priceRatio && p.initialPriceToken1PerToken0) {
          try {
            priceRatio = priceToRatioToken1PerToken0(p.initialPriceToken1PerToken0, decimals0Sorted, decimals1Sorted);
          } catch {}
        }

        if (!priceRatio && amount0DesiredWei > 0n && amount1DesiredWei > 0n) {
          priceRatio = { priceNum: amount1DesiredWei, priceDen: amount0DesiredWei } as const;
        }

        if (priceRatio && priceRatio.priceNum > 0n && priceRatio.priceDen > 0n) {
          const amount1FromAmount0 = (amount0DesiredWei * priceRatio.priceNum) / priceRatio.priceDen;
          const amount0FromAmount1 = (amount1DesiredWei * priceRatio.priceDen) / priceRatio.priceNum;
          if (token0IsWbnb && amount1FromAmount0 > 0n) {
            amount1DesiredWei = amount1FromAmount0 < amount1DesiredWei ? amount1FromAmount0 : amount1DesiredWei;
          } else if (token1IsWbnb && amount0FromAmount1 > 0n) {
            amount0DesiredWei = amount0FromAmount1 < amount0DesiredWei ? amount0FromAmount1 : amount0DesiredWei;
          }
        }

        let tickLowerInput = p.tickLower;
        let tickUpperInput = p.tickUpper;
        const scenarios: { lower: number; upper: number }[] = [{ lower: p.tickLower, upper: p.tickUpper }];
        if ((token0IsWbnb || token1IsWbnb) && priceRatio) {
          const priceFloat = Number(priceRatio.priceNum) / Number(priceRatio.priceDen);
          if (Number.isFinite(priceFloat) && priceFloat > 0) {
            const widths = [0.1, 0.05, 0.02];
            for (const width of widths) {
              const lowerPrice = priceFloat * (1 - width);
              const upperPrice = priceFloat * (1 + width);
              let tickLowerRaw = Math.log(lowerPrice) / LN_1_0001;
              let tickUpperRaw = Math.log(upperPrice) / LN_1_0001;
              if (!Number.isFinite(tickLowerRaw) || !Number.isFinite(tickUpperRaw)) continue;
              scenarios.push({ lower: Math.floor(tickLowerRaw), upper: Math.ceil(tickUpperRaw) });
            }
          }
        }

        const sendValue: bigint = 0n;

        // Always create & initialize pool if necessary (idempotent)
        {
          // Compute sqrtPriceX96 precisely from provided price or infer from desired amounts
          let sqrtPriceX96: bigint;
          if (p.initialPriceToken1PerToken0 && Number(p.initialPriceToken1PerToken0) > 0) {
            // Use decimals corresponding to sorted token0/token1
            sqrtPriceX96 = priceToSqrtX96Token1PerToken0(p.initialPriceToken1PerToken0, decimals0Sorted, decimals1Sorted);
          } else {
            // infer from desired amounts: price ~ (amount1/10^d1) / (amount0/10^d0)
            const a0 = parseUnits((p.amount0Desired || '1') as `${number}` as string, decimals0Sorted);
            const a1 = parseUnits((p.amount1Desired || '1') as `${number}` as string, decimals1Sorted);
            if (a0 === 0n) sqrtPriceX96 = 79228162514264337593543950336n; // 1:1
            else sqrtPriceX96 = encodeSqrtRatioX96(a1, a0);
          }
          try {
            const initTx = await walletClient.writeContract({
              address: cfg.positionManager,
              abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
              functionName: "createAndInitializePoolIfNecessary",
              args: [token0Sorted, token1Sorted, p.fee, sqrtPriceX96],
              chain: walletClient.chain,
              account: to,
            });
            const initRcpt = await publicClient.waitForTransactionReceipt({ hash: initTx });
            if (initRcpt.status !== 'success') {
              throw new Error("Pool initialization reverted");
            }
          } catch {
            // If pool already exists, this call is a no-op; ignore errors
          }
          // Verify pool exists after init attempt (only if factory is deployed on this chain)
          try {
            const code = await publicClient.getBytecode({ address: cfg.factory });
            if (code && code !== '0x') {
              const poolAddr = (await publicClient.readContract({
                address: cfg.factory,
                abi: V3_FACTORY_ABI,
                functionName: 'getPool',
                args: [token0Sorted, token1Sorted, p.fee],
              })) as Address;
              if (!poolAddr || String(poolAddr).toLowerCase() === '0x0000000000000000000000000000000000000000') {
                throw new Error('Pool not found after initialization. Check initial price and inputs.');
              }
            } // else: factory not deployed/unknown on this testnet, skip verification
          } catch (e: any) {
            const m = String(e?.shortMessage || e?.message || '').toLowerCase();
            if (m.includes('returned no data') || m.includes('no contract') || m.includes('execution reverted')) {
              // Skip factory verification on RPCs without factory or missing ABI support
            } else {
              setPending(false); setError(e?.shortMessage || e?.message || 'Pool not available');
              throw e;
            }
          }
        }

        // Pre-flight simulation: iterate posibles rangos hasta encontrar uno que use BNB real
        const amount0Min = 0n;
        const amount1Min = 0n;
        if (amount0DesiredWei <= 0n && amount1DesiredWei <= 0n) throw new Error("Amounts must be greater than 0");

        let simulationSuccess: {
          ticks: { lower: number; upper: number };
          simulation: Awaited<ReturnType<typeof publicClient.simulateContract>>;
          simulatedAmount0Used: bigint;
          simulatedAmount1Used: bigint;
        } | null = null;
        let lastSimError: any = null;

        for (const scenario of scenarios) {
          const ticksCandidate = alignTicks(p.fee, scenario.lower, scenario.upper);
          const argsObjCandidate = {
            token0: token0Sorted,
            token1: token1Sorted,
            fee: p.fee,
            tickLower: ticksCandidate.lower,
            tickUpper: ticksCandidate.upper,
            amount0Desired: amount0DesiredWei,
            amount1Desired: amount1DesiredWei,
            amount0Min,
            amount1Min,
            recipient: to,
            deadline,
          } as const;

          try {
            const simulation = await publicClient.simulateContract({
              address: cfg.positionManager,
              abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
              functionName: "mint",
              args: [argsObjCandidate],
              account: to,
              chain: walletClient.chain,
              value: sendValue,
            });
            const simResult = simulation.result as readonly [bigint, bigint, bigint, bigint];
            const simAmount0 = Array.isArray(simResult) && simResult.length >= 3 ? toBigInt(simResult[2]) : 0n;
            const simAmount1 = Array.isArray(simResult) && simResult.length >= 4 ? toBigInt(simResult[3]) : 0n;
            const wbnbSimUsed = token0IsWbnb ? simAmount0 : token1IsWbnb ? simAmount1 : undefined;
            if ((token0IsWbnb || token1IsWbnb) && (!wbnbSimUsed || wbnbSimUsed <= 0n)) {
              lastSimError = new Error("Simulated BNB usage is zero for this range");
              continue;
            }
            simulationSuccess = {
              ticks: ticksCandidate,
              simulation,
              simulatedAmount0Used: simAmount0,
              simulatedAmount1Used: simAmount1,
            };
            tickLowerInput = ticksCandidate.lower;
            tickUpperInput = ticksCandidate.upper;
            simulatedAmount0Used = simAmount0;
            simulatedAmount1Used = simAmount1;
            break;
          } catch (err) {
            lastSimError = err;
            continue;
          }
        }

        if (!simulationSuccess) {
          const msg = "No se pudo encontrar un rango que deposite BNB con los montos actuales. Ajusta precio/rango o incrementa los importes.";
          setPending(false);
          setError(msg);
          throw lastSimError instanceof Error ? lastSimError : new Error(msg);
        }

        // Approvals to PositionManager (only for non-wrapped side)
        await approveIfNeeded(token0Sorted, to, cfg.positionManager, amount0DesiredWei);
        await approveIfNeeded(token1Sorted, to, cfg.positionManager, amount1DesiredWei);

        if (token0IsWbnb) {
          if (amount0DesiredWei <= 0n) {
            throw new Error("Amount for native BNB must be greater than zero");
          }
          await wrapWbnbIfNeeded(amount0DesiredWei);
        }
        if (token1IsWbnb) {
          if (amount1DesiredWei <= 0n) {
            throw new Error("Amount for native BNB must be greater than zero");
          }
          await wrapWbnbIfNeeded(amount1DesiredWei);
        }
        if (token0IsWbnb || token1IsWbnb) {
          wbnbBalanceBeforeMint = await getWbnbBalance();
        }

        const txHash = await walletClient.writeContract({
          ...simulationSuccess.simulation.request,
          value: sendValue,
        });

        setTxHash(txHash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          setPending(false);
          setError('Mint reverted');
          throw new Error('Mint reverted');
        }

        let wbnbActualUsed: bigint | null = null;
        if (token0IsWbnb || token1IsWbnb) {
          try {
            const afterMintWbnb = await getWbnbBalance();
            const before = wbnbBalanceBeforeMint ?? 0n;
            wbnbActualUsed = before > afterMintWbnb ? before - afterMintWbnb : 0n;
          } catch (balanceErr) {
            console.warn("useV3Liquidity: unable to read WBNB balance after mint", balanceErr);
            wbnbActualUsed = null;
          }
        }
        try {
          const mintedIds: bigint[] = [];
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({ abi: NONFUNGIBLE_POSITION_MANAGER_ABI, data: log.data, topics: log.topics, strict: false });
              if (decoded.eventName === 'Transfer') {
                const args = decoded.args as any;
                const toAddr = (args?.to as Address | undefined)?.toLowerCase();
                const fromAddr = (args?.from as Address | undefined)?.toLowerCase();
                const tokenId = args?.tokenId as bigint | undefined;
                if (tokenId && fromAddr === '0x0000000000000000000000000000000000000000' && toAddr === address.toLowerCase()) {
                  mintedIds.push(tokenId);
                }
              }
            } catch {}
          }

          const increaseEvents = extractIncreaseEvents(receipt.logs as any);
          const eventsByTokenId = new Map<bigint, IncreaseEvent>();
          for (const evt of increaseEvents) {
            eventsByTokenId.set(evt.tokenId, evt);
          }

          if (mintedIds.length > 0) {
            for (const id of mintedIds) {
              const evt = eventsByTokenId.get(id);
              let amount0Added = evt ? evt.amount0 : (simulatedAmount0Used ?? amount0DesiredWei);
              let amount1Added = evt ? evt.amount1 : (simulatedAmount1Used ?? amount1DesiredWei);
              if ((token0IsWbnb || token1IsWbnb) && wbnbActualUsed !== null) {
                if (token0IsWbnb) {
                  amount0Added = wbnbActualUsed;
                } else if (token1IsWbnb) {
                  amount1Added = wbnbActualUsed;
                }
              }
              recordDepositedAmounts(id, amount0Added, amount1Added);
              if ((token0IsWbnb || token1IsWbnb) && (token0IsWbnb ? amount0Added : amount1Added) <= 0n) {
                console.warn("useV3Liquidity: minted with zero WBNB despite pre-check", { tokenId: id.toString(), amount0Added: amount0Added.toString(), amount1Added: amount1Added.toString() });
              }
            }
            setRecentTokenIds((prev) => {
              const merged = new Set(prev);
              for (const id of mintedIds) merged.add(id);
              return Array.from(merged);
            });
            if (typeof window !== 'undefined') {
              const key = `v3-positions-${address.toLowerCase()}`;
              try {
                const existingRaw = window.localStorage.getItem(key);
                const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
                const merged = new Set(existing);
                for (const id of mintedIds) merged.add(id.toString());
                const arr = Array.from(merged);
                window.localStorage.setItem(key, JSON.stringify(arr));
                window.dispatchEvent(new CustomEvent('v3-positions-updated', { detail: { address: address.toLowerCase(), tokenIds: arr } }));
              } catch {}
            }
          }
        } catch {}
        setPending(false);
        return { txHash: tx, receipt };
      } catch (e: any) {
        const msg = e?.shortMessage || e?.message || "Mint failed";
        setPending(false); setError(msg);
        throw e;
      }
    },
    [address, chainId, cfg, publicClient, walletClient, approveIfNeeded, recordDepositedAmounts, wrapWbnbIfNeeded]
  );

  const increase = useCallback(
    async (p: IncreaseParams) => {
      try {
        if (!publicClient || !walletClient || !address) throw new Error("Wallet not connected");
        if (chainId !== 97) throw new Error("This action is enabled for testnet 97 only");
        if (!cfg) throw new Error("Pancake V3 config missing for this chain");
        setPending(true); setError(undefined); setTxHash(undefined);

        const to = address as Address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
        const amount0Wei = parseUnits(p.amount0Desired as `${number}` as string, p.amount0Decimals);
        const amount1Wei = parseUnits(p.amount1Desired as `${number}` as string, p.amount1Decimals);
        const bps = BigInt(p.slippageBps ?? 100);
        const amount0Min = amount0Wei - (amount0Wei * bps) / 10_000n;
        const amount1Min = amount1Wei - (amount1Wei * bps) / 10_000n;

        // Read position to get token addresses and approve correctly
        const pos = await publicClient.readContract({ address: cfg.positionManager, abi: NONFUNGIBLE_POSITION_MANAGER_ABI, functionName: "positions", args: [p.tokenId] }) as any;
        const token0: Address = pos.token0 as Address;
        const token1: Address = pos.token1 as Address;
        const wbnb = cfg.wbnb.toLowerCase();
        if ((token0 as Address).toLowerCase() === wbnb) {
          await wrapWbnbIfNeeded(amount0Wei);
        }
        if ((token1 as Address).toLowerCase() === wbnb) {
          await wrapWbnbIfNeeded(amount1Wei);
        }
        await approveIfNeeded(token0, to, cfg.positionManager, amount0Wei);
        await approveIfNeeded(token1, to, cfg.positionManager, amount1Wei);

        const tx = await walletClient.writeContract({
          address: cfg.positionManager,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: "increaseLiquidity",
          args: [
            {
              tokenId: p.tokenId,
              amount0Desired: amount0Wei,
              amount1Desired: amount1Wei,
              amount0Min,
              amount1Min,
              deadline,
            },
          ],
          chain: walletClient.chain,
          account: to,
        });
        setTxHash(tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        recordDepositedAmounts(p.tokenId, amount0Wei, amount1Wei);
        setPending(false);
        return { txHash: tx, receipt };
      } catch (e: any) {
        setPending(false); setError(e?.shortMessage || e?.message || "Increase failed");
        throw e;
      }
    },
    [address, chainId, cfg, publicClient, walletClient, approveIfNeeded, recordDepositedAmounts]
  );

  const decrease = useCallback(
    async (p: DecreaseParams) => {
      try {
        if (!publicClient || !walletClient || !address) throw new Error("Wallet not connected");
        if (chainId !== 97) throw new Error("This action is enabled for testnet 97 only");
        if (!cfg) throw new Error("Pancake V3 config missing for this chain");
        setPending(true); setError(undefined); setTxHash(undefined);

        const to = address as Address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

        const beforeDecreaseWbnb = await getWbnbBalance();

        const tx = await walletClient.writeContract({
          address: cfg.positionManager,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: "decreaseLiquidity",
          args: [
            {
              tokenId: p.tokenId,
              liquidity: p.liquidity,
              amount0Min: p.amount0Min ?? 0n,
              amount1Min: p.amount1Min ?? 0n,
              deadline,
            },
          ],
          chain: walletClient.chain,
          account: to,
        });
        setTxHash(tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

        try {
          const afterDecreaseWbnb = await getWbnbBalance();
          const decreaseGained = afterDecreaseWbnb > beforeDecreaseWbnb ? afterDecreaseWbnb - beforeDecreaseWbnb : 0n;
          if (decreaseGained > 0n) {
            await unwrapWbnbAmount(decreaseGained);
          }
        } catch (unwrapAfterDecreaseErr) {
          console.warn("useV3Liquidity: unwrap after decrease failed", unwrapAfterDecreaseErr);
          setPending(false);
          setError((unwrapAfterDecreaseErr as any)?.shortMessage || (unwrapAfterDecreaseErr as Error)?.message || "Failed to unwrap WBNB after decrease");
          throw unwrapAfterDecreaseErr;
        }

        let collectResult: { txHash: Hex; receipt: any } | null = null;
        try {
          collectResult = await collectPosition(p.tokenId, to);
          if (collectResult?.txHash) {
            setTxHash(collectResult.txHash);
          }
        } catch (collectErr: any) {
          setPending(false);
          setError(collectErr?.shortMessage || collectErr?.message || "Collect after decrease failed");
          throw collectErr;
        }
        await maybeBurnPosition(p.tokenId);
        clearDepositedAmounts(p.tokenId);
        setPending(false);
        return { txHash: tx, receipt, collectTxHash: collectResult?.txHash };
      } catch (e: any) {
        setPending(false); setError(e?.shortMessage || e?.message || "Decrease failed");
        throw e;
      }
    },
    [address, chainId, cfg, clearDepositedAmounts, collectPosition, getWbnbBalance, maybeBurnPosition, publicClient, unwrapWbnbAmount, walletClient]
  );

  const collect = useCallback(
    async (p: CollectParams) => {
      try {
        if (!publicClient || !walletClient || !address) throw new Error("Wallet not connected");
        if (chainId !== 97) throw new Error("This action is enabled for testnet 97 only");
        if (!cfg) throw new Error("Pancake V3 config missing for this chain");
        setPending(true); setError(undefined); setTxHash(undefined);

        const result = await collectPosition(
          p.tokenId,
          p.recipient,
          p.amount0Max,
          p.amount1Max,
        );
        setTxHash(result.txHash);
        await maybeBurnPosition(p.tokenId);
        clearDepositedAmounts(p.tokenId);
        setPending(false);
        return result;
      } catch (e: any) {
        setPending(false); setError(e?.shortMessage || e?.message || "Collect failed");
        throw e;
      }
    },
    [address, chainId, cfg, clearDepositedAmounts, collectPosition, maybeBurnPosition]
  );

  const listPositions = useCallback(
    async (owner: Address): Promise<bigint[]> => {
      if (!publicClient || !cfg) throw new Error("Client not ready");
      // Ensure the provided address is a contract on this network
      const bytecode = await publicClient.getBytecode({ address: cfg.positionManager });
      if (!bytecode) {
        throw new Error(`PositionManager not deployed on this network (address ${cfg.positionManager}). Check testnet addresses.`);
      }
      try {
        const count = (await publicClient.readContract({ address: cfg.positionManager, abi: NONFUNGIBLE_POSITION_MANAGER_ABI, functionName: "balanceOf", args: [owner] })) as bigint;
        const total = Number(count);
        if (total > 0) {
          const ids: bigint[] = [];
          for (let i = 0; i < total; i++) {
            const id = (await publicClient.readContract({ address: cfg.positionManager, abi: NONFUNGIBLE_POSITION_MANAGER_ABI, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] })) as bigint;
            ids.push(id);
          }
          return ids;
        }
      } catch (_) {
        // fall through to logs-based enumeration
      }

      // Logs-based fallback: query Transfer events in chunks and compute holdings manually
      const transferEvent = (NONFUNGIBLE_POSITION_MANAGER_ABI as any).find((e: any) => e.type === 'event' && e.name === 'Transfer');
      const latestBlock = await publicClient.getBlockNumber();
      const span = 1_000_000n;
      const chunk = 10_000n; // stay within RPC limits
      const held = new Set<string>();

      let start = latestBlock > span ? latestBlock - span : 0n;
      while (start <= latestBlock) {
        const end = start + chunk >= latestBlock ? latestBlock : start + chunk;
        let toLogs: any[] = [];
        let fromLogs: any[] = [];
        try {
          toLogs = await publicClient.getLogs({
            address: cfg.positionManager,
            event: transferEvent,
            args: { to: owner },
            fromBlock: start,
            toBlock: end,
          } as any);
          fromLogs = await publicClient.getLogs({
            address: cfg.positionManager,
            event: transferEvent,
            args: { from: owner },
            fromBlock: start,
            toBlock: end,
          } as any);
        } catch {
          const topicsTo = encodeEventTopics({
            abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
            eventName: "Transfer",
            args: { to: owner },
          });
          const topicsFrom = encodeEventTopics({
            abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
            eventName: "Transfer",
            args: { from: owner },
          });
          toLogs = await (publicClient as any).getLogs({
            address: cfg.positionManager,
            topics: topicsTo,
            fromBlock: start,
            toBlock: end,
          });
          fromLogs = await (publicClient as any).getLogs({
            address: cfg.positionManager,
            topics: topicsFrom,
            fromBlock: start,
            toBlock: end,
          });
        }

        for (const log of toLogs) {
          try {
            const decoded = decodeEventLog({ abi: NONFUNGIBLE_POSITION_MANAGER_ABI, data: log.data, topics: log.topics });
            const tokenId = (decoded.args as any)?.tokenId as bigint | undefined;
            if (tokenId !== undefined) held.add(tokenId.toString());
          } catch {}
        }
        for (const log of fromLogs) {
          try {
            const decoded = decodeEventLog({ abi: NONFUNGIBLE_POSITION_MANAGER_ABI, data: log.data, topics: log.topics });
            const tokenId = (decoded.args as any)?.tokenId as bigint | undefined;
            if (tokenId !== undefined) held.delete(tokenId.toString());
          } catch {}
        }

        if (end === latestBlock) break;
        start = end + 1n;
      }

      return Array.from(held).map((s) => BigInt(s));
    },
    [publicClient, cfg]
  );

  const getPosition = useCallback(
    async (tokenId: bigint) => {
      if (!publicClient || !cfg) throw new Error("Client not ready");
      const p = await publicClient.readContract({ address: cfg.positionManager, abi: NONFUNGIBLE_POSITION_MANAGER_ABI, functionName: "positions", args: [tokenId] });
      return p as any;
    },
    [publicClient, cfg]
  );

  return { pending, txHash, error, recentTokenIds, approveIfNeeded, mint, increase, decrease, collect, listPositions, getPosition };
}
