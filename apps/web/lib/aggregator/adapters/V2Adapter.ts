import { Address, PublicClient } from 'viem';

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

export async function getAmountsOut(
  client: PublicClient,
  router: Address,
  amountIn: bigint,
  path: Address[],
  timeoutMs = Number(process.env.NEXT_PUBLIC_QUOTE_TIMEOUT_MS || 3000)
): Promise<bigint | null> {
  const run = client
    .readContract({ address: router, abi: V2_ROUTER_ABI, functionName: 'getAmountsOut', args: [amountIn, path] })
    .then((amounts) => {
      const arr = amounts as unknown as bigint[];
      if (!Array.isArray(arr) || arr.length !== path.length) return null;
      const out = arr[arr.length - 1];
      return out > 0n ? out : null;
    })
    .catch(() => null);

  if (!timeoutMs || timeoutMs <= 0) return run;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([run, timeout]);
}

export async function getAmountsIn(
  client: PublicClient,
  router: Address,
  amountOut: bigint,
  path: Address[],
  timeoutMs = Number(process.env.NEXT_PUBLIC_QUOTE_TIMEOUT_MS || 3000)
): Promise<bigint | null> {
  const run = client
    .readContract({ address: router, abi: V2_ROUTER_ABI, functionName: 'getAmountsIn', args: [amountOut, path] })
    .then((amounts) => {
      const arr = amounts as unknown as bigint[];
      if (!Array.isArray(arr) || arr.length !== path.length) return null;
      const requiredIn = arr[0];
      return requiredIn > 0n ? requiredIn : null;
    })
    .catch(() => null);

  if (!timeoutMs || timeoutMs <= 0) return run;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([run, timeout]);
}
