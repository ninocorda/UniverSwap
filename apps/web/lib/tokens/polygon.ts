import type { Address } from 'viem';

export const POLYGON_TOKENS: Record<string, { address: Address; decimals: number }> = {
  // WETH on Polygon
  ETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
  USDT: { address: '0xc2132D05D31c914a87C6611C10748AaCbE0dB883', decimals: 6 },
};
