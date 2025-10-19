import type { Address } from 'viem';

// Minimal QuoterV2 ABI subset for quoting exact input single
export const QUOTER_V2_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "quoteExactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
      { "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
      { "internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32" },
      { "internalType": "uint256", "name": "gasEstimate", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const QUOTER_V2_ADDRESS: Record<number, Address> = {
  // Ethereum mainnet
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  // Add other chains' quoter addresses here as we expand
  // Polygon (Quoter V2)
  137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  // Arbitrum One (Quoter V2)
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  // BSC (Pancake V3 Quoter address compatible with UniV3 QuoterV2 ABI)
  56: '0xB048BBA1c7eCbd1bB768a5fC152B4fFAb8eE3C6c',
};
