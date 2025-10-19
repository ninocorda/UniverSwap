export type TokenInfo = {
  address: `0x${string}`;
  symbol: string;
  name?: string;
  logo?: string; // URL or path
};

// Minimal curated tokens for BSC & BSC Testnet
export const TOKENS_97: Record<string, TokenInfo> = {
  // lowercase keys
  '0xae13d989dac2f0debff460ac112a837c89baa7cd': {
    address: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    symbol: 'WBNB',
    name: 'Wrapped BNB (Testnet)',
    logo: '/images/tokens/images/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c.png',
  },
  '0x7ef95a0febf6a1a8b7f49c88ad36b47ff6bc8bd0': {
    address: '0x7ef95a0FeBf6a1A8B7f49C88aD36b47fF6bC8Bd0',
    symbol: 'USDT',
    name: 'Tether USD (Testnet)',
    logo: '/images/tokens/images/eth/0xdAC17F958D2ee523a2206206994597C13D831ec7.png',
  },
  '0x64544969ed7ebf5f083679233325356ebe738930': {
    address: '0x64544969ed7EBf5f083679233325356EbE738930',
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    logo: '/images/tokens/images/eth/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.png',
  },
  '0xfa60d973f7642b748046464e165a65b7323b0dee': {
    address: '0xFa60D973F7642B748046464e165A65B7323b0DEE',
    symbol: 'CAKE',
    name: 'PancakeSwap Token (Testnet)',
    logo: '/images/tokens/images/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82.png',
  },
  // Add ETH as a separate token (not alias to WBNB)
  '0x0000000000000000000000000000000000000000': {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum (Testnet)',
    logo: '/images/tokens/images/eth/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2.png',
  },
};

export function getTokenInfo(chainId: number, address: string | undefined | null): TokenInfo | undefined {
  if (!address) return undefined;
  const addr = address.toLowerCase();
  if (chainId === 97) return TOKENS_97[addr];
  return undefined;
}

// Token map for routing/quoting: minimal set per chain with decimals
export type RouteToken = { address: `0x${string}`; decimals: number };
export type RouteTokenMap = Record<string, RouteToken>;

export function getTokensForChain(chainId: number): RouteTokenMap | undefined {
  // BSC Testnet (97)
  if (chainId === 97) {
    const WBNB = '0xae13d989dac2f0debff460ac112a837c89baa7cd' as `0x${string}`;
    const USDT = '0x7ef95a0FeBf6a1A8B7f49C88aD36b47fF6bC8Bd0' as `0x${string}`;
    const USDC = '0x64544969ed7EBf5f083679233325356EbE738930' as `0x${string}`;
    const BUSD = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47' as `0x${string}`; // testnet BUSD
    const CAKE = '0xFa60D973F7642B748046464e165A65B7323b0DEE' as `0x${string}`; // testnet CAKE
    return {
      // Native and wrapped
      BNB: { address: WBNB, decimals: 18 },
      WBNB: { address: WBNB, decimals: 18 },
      // ETH as separate token (not alias to WBNB)
      ETH: { address: '0x0000000000000000000000000000000000000000' as `0x${string}`, decimals: 18 },
      // Stables
      USDT: { address: USDT, decimals: 18 },
      USDC: { address: USDC, decimals: 18 },
      BUSD: { address: BUSD, decimals: 18 },
      // DEX token (often available on testnet)
      CAKE: { address: CAKE, decimals: 18 },
    };
  }
  // BSC Mainnet (56)
  if (chainId === 56) {
    const WBNB = '0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`;
    const USDT = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`; // 18
    const USDC = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' as `0x${string}`; // 18
    const BUSD = '0xe9e7cea3dedca5984780bafc599bd69add087d56' as `0x${string}`; // 18 (legacy)
    const CAKE = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' as `0x${string}`; // 18
    return {
      BNB: { address: WBNB, decimals: 18 },
      WBNB: { address: WBNB, decimals: 18 },
      ETH: { address: '0x0000000000000000000000000000000000000000' as `0x${string}`, decimals: 18 },
      USDT: { address: USDT, decimals: 18 },
      USDC: { address: USDC, decimals: 18 },
      BUSD: { address: BUSD, decimals: 18 },
      CAKE: { address: CAKE, decimals: 18 },
    };
  }
  // Placeholder for future chains (1, 137, 42161)
  return undefined;
}

export function getNativeSymbol(chainId: number): string | undefined {
  if (chainId === 97 || chainId === 56) return 'BNB';
  return undefined;
}

export function getWrappedNativeAddress(chainId: number): `0x${string}` | undefined {
  if (chainId === 97) return '0xae13d989dac2f0debff460ac112a837c89baa7cd';
  if (chainId === 56) return '0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  return undefined;
}
