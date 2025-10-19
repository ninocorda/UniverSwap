import type { Address } from 'viem';

// BSC Testnet tokens
export const BSC_TESTNET_TOKENS: Record<string, { address: Address; decimals: number }> = {
  ETH: { address: '0xae13d989dac2f0debff460ac112a837c89baa7cd', decimals: 18 }, // WBNB testnet
  USDT: { address: '0x7ef95a0fe8cf87a74a24d3e2a2a0fda4c2c8b9e0', decimals: 18 },
  BUSD: { address: '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47', decimals: 18 },
  CAKE: { address: '0xFa60D973F7642B748046464e165A65B7323b0DEE', decimals: 18 },
  // Add more as needed
};
