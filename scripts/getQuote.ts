import { quoteAggregatedSwap } from "../apps/web/lib/aggregator";

async function main() {
  const chainId = 97; // BSC testnet

  const tokenIn = "0x64544969ed7ebf5f083679233325356ebe738930"; // USDC
  const tokenOut = "0xae13d989dac2f0debff460ac112a837c89baa7cd"; // WBNB
  const amount = 5n * 10n ** 17n; // 0.5 USDC (18 decimales en testnet)
  const mode = "exact-in" as const;

  const quote = await quoteAggregatedSwap({ chainId, tokenIn, tokenOut, amount, mode });

  console.log("Quote ->", {
    router: quote.router.address,
    path: quote.path,
    amountIn: quote.amountIn.toString(),
    amountOut: quote.amountOut.toString(),
    forwardPrice: quote.forwardPrice,
    reversePrice: quote.reversePrice,
    spreadBps: quote.spreadBps,
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
