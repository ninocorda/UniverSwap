export const IDOFactoryABI = [
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'saleToken', type: 'address' },
      { internalType: 'address', name: 'raiseToken', type: 'address' },
      { internalType: 'address', name: 'fundsRecipient', type: 'address' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'uint256', name: 'softCap', type: 'uint256' },
      { internalType: 'uint256', name: 'hardCap', type: 'uint256' },
      { internalType: 'uint256', name: 'minContribution', type: 'uint256' },
      { internalType: 'uint256', name: 'maxContribution', type: 'uint256' },
      { internalType: 'uint256', name: 'tokensPerUnit', type: 'uint256' },
      { internalType: 'bool', name: 'whitelistEnabled', type: 'bool' },
    ],
    name: 'createPool',
    outputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllPools',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
