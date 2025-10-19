import { Address, PublicClient } from 'viem';

export type QuoteMode = 'exact-in' | 'exact-out';

export interface RouterConfig {
  name: string;
  address: Address;
}

export interface QuoteRouteParams {
  client: PublicClient;
  router: RouterConfig;
  path: Address[];
  amount: bigint;
  mode: QuoteMode;
  timeoutMs?: number;
}

export interface QuoteRouteResult {
  router: RouterConfig;
  path: Address[];
  amountIn: bigint;
  amountOut: bigint;
  forwardPrice: number;
  reversePrice: number;
  midPrice: number;
  spreadBps: number;
}

const V2_ROUTER_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsIn',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T | null> {
  if (!timeoutMs || timeoutMs <= 0) return promise.catch(() => null);
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
  });
  const result = await Promise.race([promise.catch(() => null), timeoutPromise]);
  clearTimeout(timeoutHandle!);
  return result as T | null;
}

async function getAmountsOut(
  client: PublicClient,
  router: Address,
  amountIn: bigint,
  path: Address[],
  timeoutMs?: number
): Promise<bigint | null> {
  const call = client
    .readContract({ address: router, abi: V2_ROUTER_ABI, functionName: 'getAmountsOut', args: [amountIn, path] })
    .then((amounts) => {
      const arr = amounts as unknown as bigint[];
      if (!Array.isArray(arr) || arr.length !== path.length) return null;
      const out = arr[arr.length - 1];
      return out > 0n ? out : null;
    });
  return callWithTimeout(call, timeoutMs);
}

async function getAmountsIn(
  client: PublicClient,
  router: Address,
  amountOut: bigint,
  path: Address[],
  timeoutMs?: number
): Promise<bigint | null> {
  const call = client
    .readContract({ address: router, abi: V2_ROUTER_ABI, functionName: 'getAmountsIn', args: [amountOut, path] })
    .then((amounts) => {
      const arr = amounts as unknown as bigint[];
      if (!Array.isArray(arr) || arr.length !== path.length) return null;
      const required = arr[0];
      return required > 0n ? required : null;
    });
  return callWithTimeout(call, timeoutMs);
}

const RATIO_SCALE = 1_000_000_000n;

function computeRatio(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return Number.POSITIVE_INFINITY;
  const scaled = (numerator * RATIO_SCALE) / denominator;
  return Number(scaled) / Number(RATIO_SCALE);
}

export async function quoteRoute(params: QuoteRouteParams): Promise<QuoteRouteResult | null> {
  const { client, router, path, amount, mode, timeoutMs } = params;
  if (!Array.isArray(path) || path.length < 2) return null;
  if (!amount || amount <= 0n) return null;

  let computedAmountIn: bigint;
  let computedAmountOut: bigint;
  let forwardAmountOut: bigint;
  let reverseAmountIn: bigint;

  if (mode === 'exact-in') {
    computedAmountIn = amount;
    const outExactIn = await getAmountsOut(client, router.address, computedAmountIn, path, timeoutMs);
    if (!outExactIn || outExactIn <= 0n) return null;
    computedAmountOut = outExactIn;

    const reqInForOut = await getAmountsIn(client, router.address, computedAmountOut, path, timeoutMs);
    if (!reqInForOut || reqInForOut <= 0n) return null;

    forwardAmountOut = computedAmountOut;
    reverseAmountIn = reqInForOut;
  } else {
    computedAmountOut = amount;
    const reqInForOut = await getAmountsIn(client, router.address, computedAmountOut, path, timeoutMs);
    if (!reqInForOut || reqInForOut <= 0n) return null;
    computedAmountIn = reqInForOut;

    const outExactIn = await getAmountsOut(client, router.address, computedAmountIn, path, timeoutMs);
    if (!outExactIn || outExactIn <= 0n) return null;

    forwardAmountOut = outExactIn;
    reverseAmountIn = computedAmountIn;

    // Ensure the forward amount matches target within reasonable tolerance
    const tolerance = computedAmountOut / 100n; // 1%
    const diff = forwardAmountOut > computedAmountOut ? forwardAmountOut - computedAmountOut : computedAmountOut - forwardAmountOut;
    if (diff > tolerance) {
      return null;
    }
  }

  const forwardPrice = computeRatio(forwardAmountOut, computedAmountIn);
  const reversePrice = computeRatio(computedAmountOut, reverseAmountIn);
  if (!Number.isFinite(forwardPrice) || !Number.isFinite(reversePrice) || forwardPrice <= 0 || reversePrice <= 0) {
    return null;
  }

  const midPrice = Math.sqrt(forwardPrice * reversePrice);
  if (!Number.isFinite(midPrice) || midPrice <= 0) return null;

  const spreadBps = Math.abs(forwardPrice - reversePrice) / midPrice * 10_000;
  if (!Number.isFinite(spreadBps) || spreadBps > 100) {
    return null;
  }

  return {
    router,
    path,
    amountIn: computedAmountIn,
    amountOut: computedAmountOut,
    forwardPrice,
    reversePrice,
    midPrice,
    spreadBps,
  };
}
