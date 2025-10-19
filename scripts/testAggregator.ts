import { Address } from 'viem';

import { quoteAggregatedSwap } from '../apps/web/lib/aggregator';
import { type QuoteMode } from '../apps/web/lib/aggregator/quoteRoute';

interface TestPair {
  label: string;
  tokenIn: Address;
  tokenOut: Address;
  /** Amount expressed in smallest units (18 decimals by default). */
  amount: bigint;
}

const DEFAULT_AMOUNT = 1n * 10n ** 18n; // 1 token with 18 decimals

const TEST_PAIRS: TestPair[] = [
  {
    label: 'USDC ↔ WBNB',
    tokenIn: '0x64544969ed7EBf6f083679233325356EbE738930',
    tokenOut: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    amount: DEFAULT_AMOUNT,
  },
  {
    label: 'USDT ↔ WBNB',
    tokenIn: '0x7ef95a0FeBf6a1A8B7f49C88aD36b47fF6bC8Bd0',
    tokenOut: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    amount: DEFAULT_AMOUNT,
  },
  {
    label: 'CAKE ↔ WBNB',
    tokenIn: '0xFa60D973F7642B748046464e165A65B7323b0DEE',
    tokenOut: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    amount: DEFAULT_AMOUNT,
  },
];

const MODES: QuoteMode[] = ['exact-in', 'exact-out'];

async function run() {
  const chainId = Number(process.env.TEST_CHAIN_ID || 97);

  for (const pair of TEST_PAIRS) {
    for (const mode of MODES) {
      const modeLabel = mode === 'exact-in' ? 'exact-in' : 'exact-out';
      try {
        const quote = await quoteAggregatedSwap({
          chainId,
          tokenIn: pair.tokenIn,
          tokenOut: pair.tokenOut,
          amount: pair.amount,
          mode,
        });

        const info = {
          pair: pair.label,
          mode: modeLabel,
          router: quote.router.name,
          path: quote.path,
          amountIn: quote.amountIn.toString(),
          amountOut: quote.amountOut.toString(),
          forwardPrice: quote.forwardPrice,
          reversePrice: quote.reversePrice,
          spreadBps: quote.spreadBps,
        };

        if (quote.spreadBps > 100) {
          console.warn('[warn] spread too high', info);
        } else {
          console.log('[ok]', info);
        }
      } catch (err) {
        console.error('[error]', {
          pair: pair.label,
          mode: modeLabel,
          message: (err as Error).message,
        });
      }
    }
  }
}

run().catch((err) => {
  console.error('Unexpected failure', err);
  process.exitCode = 1;
});
