import { ethers } from "hardhat";

async function main() {
  const routerAddress = "0xbe6A77f9F4b43473AEFdF57e6F60aD39495783A6";

  const router = await ethers.getContractAt("AggregatorRouter", routerAddress);

  const amountIn = 5n * 10n ** 17n; // 0.5 USDC (18 decimales en testnet)
  const amountOut = 21893512897720400n; // desde quote
  const minAmountOut = (amountOut * 995n) / 1000n; // 0.5% tolerancia

  const hops = [
    {
      router: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
      path: [
        "0x64544969ed7ebf5f083679233325356ebe738930",
        "0xae13d989dac2f0debff460ac112a837c89baa7cd",
      ],
    },
  ] as const;

  const params = {
    tokenIn: "0x64544969ed7ebf5f083679233325356ebe738930",
    tokenOut: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
    amountIn,
    minAmountOut,
    recipient: "0x7afa70D45bD844283337dab245a9E33f11961336",
    deadline: Math.floor(Date.now() / 1000) + 300,
    hops,
  } as const;

  const tx = await router.swapExactTokensForTokensOnChain(params);
  const receipt = await tx.wait();

  console.log("Swap tx hash:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
