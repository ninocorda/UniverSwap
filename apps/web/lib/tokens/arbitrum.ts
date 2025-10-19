import type { Address } from 'viem';

export const ARBITRUM_TOKENS: Record<string, { address: Address; decimals: number }> = {
  // WETH on Arbitrum
  ETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
  USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 }, // USDC.e (native USDC)
  USDT: { address: '0xfd086bc7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
};
