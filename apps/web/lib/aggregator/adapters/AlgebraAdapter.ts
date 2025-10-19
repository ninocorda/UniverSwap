import type { Address, PublicClient } from 'viem';

export type AlgebraQuote = { amountOut: bigint };

// Minimal Algebra quoter ABI (quoteExactInputSingle)
// Note: Algebra (THENA CL) may expose this via IAlgebraQuoterV2-compatible interface.
const ALGEBRA_QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'limitSqrtPrice', type: 'uint160' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
    ],
  },
 ] as const;

export async function algebraQuoterQuote(
  client: PublicClient,
  quoter: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  timeoutMs: number = 3000
): Promise<AlgebraQuote[]> {
  const task = (async () => {
    try {
      const amountOut = await client.readContract({
        abi: ALGEBRA_QUOTER_ABI as any,
        address: quoter,
        functionName: 'quoteExactInputSingle',
        args: [tokenIn, tokenOut, amountIn, 0n],
      } as any);
      const out = amountOut as unknown as bigint;
      if (!out || out <= 0n) return [];
      return [{ amountOut: out }];
    } catch {
      return [];
    }
  })();

  const timeout = new Promise<AlgebraQuote[]>((resolve) => setTimeout(() => resolve([]), Math.max(500, timeoutMs)));
  return Promise.race([task, timeout]);
}
