export const TokenVestingABI = [
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      {
        components: [
          { internalType: 'address', name: 'beneficiary', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint64', name: 'releaseTime', type: 'uint64' },
        ],
        internalType: 'struct TokenVesting.VestingRequest[]',
        name: 'requests',
        type: 'tuple[]',
      },
    ],
    name: 'createVestingBatch',
    outputs: [
      { internalType: 'uint256', name: 'firstId', type: 'uint256' },
      { internalType: 'uint256', name: 'count', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'vestingId', type: 'uint256' }],
    name: 'release',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'vestings',
    outputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'funder', type: 'address' },
      { internalType: 'address', name: 'beneficiary', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'released', type: 'uint256' },
      { internalType: 'uint64', name: 'releaseTime', type: 'uint64' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256[]', name: 'vestingIds', type: 'uint256[]' }],
    name: 'releaseMany',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'beneficiary', type: 'address' }],
    name: 'getVestingsByBeneficiary',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'funder', type: 'address' }],
    name: 'getVestingsByFunder',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
];
