import type { Address } from 'viem';

export const PANCAKE_V3_97 = {
  chainId: 97,
  // From contratospancakeswap.md (testnet 97)
  positionManager: '0x427bF5b37357632377eCbEC9de3626C71A5396c1' as Address,
  swapRouter: '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as Address,
  quoterV2: '0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2' as Address,
  factory: '0x3bcfd4d45de5e6c3f1ef3d4e7a924d016e6f03a0' as Address,
  wbnb: '0xae13d989dac2f0debff460ac112a837c89baa7cd' as Address,
  cake: '0xFa60D973F7642B748046464e165A65B7323b0DEE' as Address,
} as const;
