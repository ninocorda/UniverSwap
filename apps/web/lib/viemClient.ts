import { Address, Chain, createPublicClient, http, PublicClient } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

// Simple per-chain client factory using RPC URLs from env
// Required envs (example):
// - NEXT_PUBLIC_RPC_56=https://bsc-dataseed.binance.org
// - NEXT_PUBLIC_RPC_97=https://data-seed-prebsc-1-s1.binance.org:8545

const DEFAULT_RPCS: Record<number, string> = {
  56: 'https://bsc-dataseed.binance.org',
  97: 'https://data-seed-prebsc-1-s1.binance.org:8545',
};

function rpcFor(chainId: number): string {
  const envUrl = process.env[`NEXT_PUBLIC_RPC_${chainId}` as any];
  return String(envUrl || DEFAULT_RPCS[chainId] || '');
}

function chainFor(chainId: number): Chain {
  if (chainId === 56) return bsc;
  if (chainId === 97) return bscTestnet;
  throw new Error(`Unsupported chainId: ${chainId}`);
}

export function getPublicClient(chainId: number): PublicClient {
  const chain = chainFor(chainId);
  const url = rpcFor(chain.id);
  if (!url) throw new Error(`No RPC URL available for chainId ${chainId}`);
  const transport = http(url);
  return createPublicClient({ chain, transport });
}
