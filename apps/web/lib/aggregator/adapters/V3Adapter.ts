import { Address, PublicClient } from 'viem';
import { QUOTER_V2_ABI } from '../../../lib/uniswap/quoterV2';

export async function quoterQuote(
  client: PublicClient,
  quoter: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  feeTiers: (500 | 3000 | 10000)[] = [500, 3000, 10000],
  timeoutMs = Number(process.env.NEXT_PUBLIC_QUOTE_TIMEOUT_MS || 3000)
): Promise<{ fee: 500 | 3000 | 10000; amountOut: bigint }[]> {
  const tasks = feeTiers.map(async (fee) => {
    const run = client
      .readContract({
        address: quoter,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96: 0n }],
      })
      .then((r) => {
        const [amountOut] = r as unknown as [bigint, bigint, number, bigint];
        return amountOut > 0n ? { fee, amountOut } : null;
      })
      .catch(() => null);

    if (!timeoutMs || timeoutMs <= 0) return run;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return Promise.race([run, timeout]);
  });

  const res = await Promise.all(tasks);
  return res.filter(Boolean) as { fee: 500 | 3000 | 10000; amountOut: bigint }[];
}
