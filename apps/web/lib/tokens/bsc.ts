import type { Address } from 'viem';

export const BSC_TOKENS: Record<string, { address: Address; decimals: number }> = {
  // WETH (WBNB actually used on BSC for native asset)
  ETH: { address: '0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
  USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
};
