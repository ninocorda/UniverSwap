import type { Address } from 'viem';

// Minimal mainnet token list for initial quoting
export const MAINNET_TOKENS: Record<string, { address: Address; decimals: number }> = {
  ETH: { address: '0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2', decimals: 18 }, // WETH
  USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
};
