import type { Address } from 'viem';

// Next.js inlines envs at build and doesn't support dynamic client-side indexing.
// Statically map known chains to envs so it works in the browser.
const ROUTERS: Record<number, Address | undefined> = {
  1: process.env.NEXT_PUBLIC_AGGREGATOR_ROUTER_1 as Address | undefined,
  56: process.env.NEXT_PUBLIC_AGGREGATOR_ROUTER_56 as Address | undefined,
  97: (process.env.NEXT_PUBLIC_AGGREGATOR_ROUTER_97 as Address | undefined) || ('0x6129ba2f951BeFa353EAE06dae732D35039770f1' as Address),
  137: process.env.NEXT_PUBLIC_AGGREGATOR_ROUTER_137 as Address | undefined,
  42161: process.env.NEXT_PUBLIC_AGGREGATOR_ROUTER_42161 as Address | undefined,
};

export function getAggregatorRouterForChain(chainId: number): Address | undefined {
  return ROUTERS[chainId];
}

// Resolve TokenFactory address per chain via env (NEXT_PUBLIC_TOKEN_FACTORY_<chainId>)
const FACTORIES: Record<number, Address | undefined> = {
  1: process.env.NEXT_PUBLIC_TOKEN_FACTORY_1 as Address | undefined,
  56: process.env.NEXT_PUBLIC_TOKEN_FACTORY_56 as Address | undefined,
  97:
    (process.env.NEXT_PUBLIC_TOKEN_FACTORY_97 as Address | undefined) ||
    ('0x67DF29cD13b9747D703DC02AC4236EA1a97C8805' as Address),
  137: process.env.NEXT_PUBLIC_TOKEN_FACTORY_137 as Address | undefined,
  42161: process.env.NEXT_PUBLIC_TOKEN_FACTORY_42161 as Address | undefined,
};

export function getTokenFactoryForChain(chainId: number): Address | undefined {
  return FACTORIES[chainId];
}

const LOCKERS: Record<number, Address | undefined> = {
  1: process.env.NEXT_PUBLIC_TOKEN_LOCKER_1 as Address | undefined,
  56: process.env.NEXT_PUBLIC_TOKEN_LOCKER_56 as Address | undefined,
  97:
    (process.env.NEXT_PUBLIC_TOKEN_LOCKER_97 as Address | undefined) ||
    ('0x0596E2afc5dC82E3BaeB202CB9e1a430636dB8BC' as Address),
  137: process.env.NEXT_PUBLIC_TOKEN_LOCKER_137 as Address | undefined,
  42161: process.env.NEXT_PUBLIC_TOKEN_LOCKER_42161 as Address | undefined,
};

export function getTokenLockerForChain(chainId: number): Address | undefined {
  return LOCKERS[chainId];
}

const VESTERS: Record<number, Address | undefined> = {
  1: process.env.NEXT_PUBLIC_TOKEN_VESTING_1 as Address | undefined,
  56: process.env.NEXT_PUBLIC_TOKEN_VESTING_56 as Address | undefined,
  97:
    (process.env.NEXT_PUBLIC_TOKEN_VESTING_97 as Address | undefined) ||
    ('0x75c1f4D56491491dDFBb64a949934FAf17Bb9c15' as Address),
  137: process.env.NEXT_PUBLIC_TOKEN_VESTING_137 as Address | undefined,
  42161: process.env.NEXT_PUBLIC_TOKEN_VESTING_42161 as Address | undefined,
};

export function getTokenVestingForChain(chainId: number): Address | undefined {
  return VESTERS[chainId];
}

// IDOFactory addresses per chain (NEXT_PUBLIC_IDO_FACTORY_<chainId>)
const IDO_FACTORIES: Record<number, Address | undefined> = {
  1: process.env.NEXT_PUBLIC_IDO_FACTORY_1 as Address | undefined,
  56: process.env.NEXT_PUBLIC_IDO_FACTORY_56 as Address | undefined,
  97: (process.env.NEXT_PUBLIC_IDO_FACTORY_97 as Address | undefined) || ('0xEddE753748032fa00DC20c54D5851f73E0F71C1D' as Address),
  137: process.env.NEXT_PUBLIC_IDO_FACTORY_137 as Address | undefined,
  42161: process.env.NEXT_PUBLIC_IDO_FACTORY_42161 as Address | undefined,
};

export function getIdoFactoryForChain(chainId: number): Address | undefined {
  return IDO_FACTORIES[chainId];
}
