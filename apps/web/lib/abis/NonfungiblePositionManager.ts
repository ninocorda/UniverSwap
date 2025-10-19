import type { Abi } from 'viem';

// Minimal ABI needed for V3 liquidity flows and position reads
export const NONFUNGIBLE_POSITION_MANAGER_ABI = [
  // ERC721 Transfer event (for log-based enumeration fallback)
  { type: 'event', name: 'Transfer', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ] },
  // ERC721
  { type: 'function', stateMutability: 'view', name: 'balanceOf', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
  { type: 'function', stateMutability: 'view', name: 'tokenOfOwnerByIndex', inputs: [ { name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' } ], outputs: [ { name: 'tokenId', type: 'uint256' } ] },
  { type: 'function', stateMutability: 'view', name: 'factory', inputs: [], outputs: [{ name: '', type: 'address' }] },
  // Positions
  {
    type: 'function', stateMutability: 'view', name: 'positions',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ]
  },
  // Create & initialize pool if necessary
  {
    type: 'function', stateMutability: 'nonpayable', name: 'createAndInitializePoolIfNecessary',
    inputs: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    outputs: [ { name: 'pool', type: 'address' } ]
  },
  // Approvals handled via ERC20 separately
  // Mint
  {
    type: 'function', stateMutability: 'payable', name: 'mint',
    inputs: [
      {
        name: 'params', type: 'tuple', components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ]
      }
    ],
    outputs: [ { name: 'tokenId', type: 'uint256' }, { name: 'liquidity', type: 'uint128' }, { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' } ]
  },
  // Increase
  {
    type: 'function', stateMutability: 'payable', name: 'increaseLiquidity',
    inputs: [
      {
        name: 'params', type: 'tuple', components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ]
      }
    ],
    outputs: [ { name: 'liquidity', type: 'uint128' }, { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' } ]
  },
  // Decrease liquidity
  {
    type: 'function', stateMutability: 'nonpayable', name: 'decreaseLiquidity',
    inputs: [
      {
        name: 'params', type: 'tuple', components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ]
      }
    ],
    outputs: [ { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' } ]
  },
  // Collect
  {
    type: 'function', stateMutability: 'nonpayable', name: 'collect',
    inputs: [
      {
        name: 'params', type: 'tuple', components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
        ]
      }
    ],
    outputs: [ { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' } ]
  },
  {
    type: 'function', stateMutability: 'nonpayable', name: 'burn',
    inputs: [ { name: 'tokenId', type: 'uint256' } ],
    outputs: [],
  },
] as const satisfies Abi;
