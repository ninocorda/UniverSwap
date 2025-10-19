'use client';

import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { Address, formatUnits, zeroAddress } from 'viem';
import { TokenFactoryABI } from '../lib/abi/TokenFactory';
import { ERC20TemplateABI } from '../lib/abi/ERC20Template';

export interface FactoryTokenRecord {
  creator: Address;
  tierId: number;
  createdAt: number;
  configHash: `0x${string}`;
}

export interface TokenFeeSplit {
  feeType: number;
  bps: number;
  recipient: Address;
}

export interface AntiWhaleState {
  enabled: boolean;
  maxTxAmount: string;
  maxWalletAmount: string;
  cooldownBlocks: number;
}

export interface FactoryTokenDetails {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  totalSupplyRaw: bigint;
  cap?: string;
  capRaw: bigint;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  paused: boolean;
  governance: boolean;
  autoLiquidity: boolean;
  antiWhale: boolean;
  staking: boolean;
  metadataURI: string;
  brandingURI: string;
  version: number;
  tierId: number;
  record: FactoryTokenRecord;
  feeSplits: TokenFeeSplit[];
  antiWhaleConfig: AntiWhaleState;
  totalFeeBps: number;
  liquidityAccumulator: string;
  liquidityAccumulatorRaw: bigint;
  liquidityRouter: Address;
  liquidityPairToken: Address;
  liquidityBps: number;
  stakingReserve: string;
  stakingReserveRaw: bigint;
}

type PublicClientType = NonNullable<ReturnType<typeof usePublicClient>>;

const toBigIntSafe = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
};

const toNumberSafe = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanSafe = (value: unknown): boolean => Boolean(value);

const toAddressSafe = (value: unknown): Address =>
  typeof value === 'string' && value.length === 42 ? (value as Address) : zeroAddress;

async function fetchTokenRecords(
  publicClient: PublicClientType,
  factoryAddress: Address,
  totalTokens: number,
): Promise<Array<{ token: Address; record: FactoryTokenRecord }>> {
  const contracts = Array.from({ length: totalTokens }, (_, index) => ({
    abi: TokenFactoryABI,
    address: factoryAddress,
    functionName: 'allTokens' as const,
    args: [BigInt(index)],
  }));

  const tokenAddresses = (await publicClient.multicall({ contracts, allowFailure: false })) as Address[];

  const recordContracts = tokenAddresses.map((token) => ({
    abi: TokenFactoryABI,
    address: factoryAddress,
    functionName: 'tokenRecords' as const,
    args: [token],
  }));

  const recordsRaw = await publicClient.multicall({ contracts: recordContracts, allowFailure: false });

  return tokenAddresses.map((token, index) => {
    const raw = recordsRaw[index] as any;
    const creator = (raw?.creator ?? raw?.[0]) as Address | undefined;
    const tierIdValue = raw?.tierId ?? raw?.[1] ?? 0;
    const createdAtValue = raw?.createdAt ?? raw?.[2] ?? 0n;
    const configHashValue = (raw?.configHash ?? raw?.[3] ?? '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`;

    const record: FactoryTokenRecord = {
      creator: (creator ?? zeroAddress) as Address,
      tierId: Number(tierIdValue),
      createdAt: Number(createdAtValue),
      configHash: configHashValue,
    };

    return { token, record };
  });
}

async function fetchTokenDetails(
  publicClient: PublicClientType,
  entries: Array<{ token: Address; record: FactoryTokenRecord }>,
): Promise<FactoryTokenDetails[]> {
  if (entries.length === 0) return [];

  const FUNCTION_NAMES = [
    'name',
    'symbol',
    'decimals',
    'totalSupply',
    'cap',
    'mintable',
    'burnable',
    'pausableEnabled',
    'governanceEnabled',
    'autoLiquidityEnabled',
    'antiWhaleEnabled',
    'stakingEnabled',
    'metadataURI',
    'brandingURI',
    'paused',
    'versionedInfo',
    'getFeeSplits',
    'getAntiWhale',
    'totalFeeBps',
    'liquidityAccumulator',
    'liquidityRouter',
    'liquidityPairToken',
    'liquidityBps',
    'stakingReserve',
  ] as const;

  const batchedContracts = entries.flatMap(({ token }) =>
    FUNCTION_NAMES.map((functionName) => ({
      address: token,
      abi: ERC20TemplateABI,
      functionName,
    })),
  );

  const results = await publicClient.multicall({ contracts: batchedContracts, allowFailure: false });
  const chunkSize = FUNCTION_NAMES.length;

  return entries.map(({ token, record }, index) => {
    const offset = index * chunkSize;
    const chunk = results.slice(offset, offset + chunkSize);
    const safeChunk = Array.from({ length: chunkSize }, (_, position) => chunk[position]);

    const [
      nameRaw,
      symbolRaw,
      decimalsRaw,
      totalSupplyRaw,
      capRaw,
      mintableRaw,
      burnableRaw,
      pausableRaw,
      governanceRaw,
      autoLiquidityRaw,
      antiWhaleRaw,
      stakingRaw,
      metadataRaw,
      brandingRaw,
      pausedRaw,
      versionedInfoRaw,
      feeSplitsRaw,
      antiWhaleConfigRaw,
      totalFeeBpsRaw,
      liquidityAccumulatorRaw,
      liquidityRouterRaw,
      liquidityPairTokenRaw,
      liquidityBpsRaw,
      stakingReserveRaw,
    ] = safeChunk as readonly unknown[];

    const decimals = toNumberSafe(decimalsRaw, 18) || 18;
    const totalSupplyValue = toBigIntSafe(totalSupplyRaw);
    const capValue = toBigIntSafe(capRaw);

    const feeSplitsSource = Array.isArray(feeSplitsRaw) ? feeSplitsRaw : [];
    const feeSplits: TokenFeeSplit[] = feeSplitsSource.map((fee: any) => ({
      feeType: toNumberSafe(fee?.feeType ?? fee?.[0], 0),
      bps: toNumberSafe(fee?.bps ?? fee?.[1], 0),
      recipient: toAddressSafe(fee?.recipient ?? fee?.[2]),
    }));

    const antiWhaleSource =
      antiWhaleConfigRaw && typeof antiWhaleConfigRaw === 'object' ? (antiWhaleConfigRaw as any) : {};

    const maxTx = toBigIntSafe(antiWhaleSource.maxTxAmount ?? antiWhaleSource[1]);
    const maxWallet = toBigIntSafe(antiWhaleSource.maxWalletAmount ?? antiWhaleSource[2]);

    const antiWhaleConfig: AntiWhaleState = {
      enabled: toBooleanSafe(antiWhaleSource.enabled ?? antiWhaleSource[0]),
      maxTxAmount: maxTx === 0n ? '0' : formatUnits(maxTx, decimals),
      maxWalletAmount: maxWallet === 0n ? '0' : formatUnits(maxWallet, decimals),
      cooldownBlocks: toNumberSafe(antiWhaleSource.cooldownBlocks ?? antiWhaleSource[3], 0),
    };

    const versionInfo = Array.isArray(versionedInfoRaw) ? versionedInfoRaw : [];
    const versionNumber = toNumberSafe(versionInfo[0], 0);
    const tierNumber = toNumberSafe(versionInfo[1], 0);

    const liquidityAccumulatorValue = toBigIntSafe(liquidityAccumulatorRaw);
    const stakingReserveValue = toBigIntSafe(stakingReserveRaw);

    return {
      address: token,
      name: typeof nameRaw === 'string' ? nameRaw : '',
      symbol: typeof symbolRaw === 'string' ? symbolRaw : '',
      decimals,
      totalSupply: formatUnits(totalSupplyValue, decimals),
      totalSupplyRaw: totalSupplyValue,
      cap: capValue === 0n ? undefined : formatUnits(capValue, decimals),
      capRaw: capValue,
      mintable: toBooleanSafe(mintableRaw),
      burnable: toBooleanSafe(burnableRaw),
      pausable: toBooleanSafe(pausableRaw),
      paused: toBooleanSafe(pausedRaw),
      governance: toBooleanSafe(governanceRaw),
      autoLiquidity: toBooleanSafe(autoLiquidityRaw),
      antiWhale: toBooleanSafe(antiWhaleRaw),
      staking: toBooleanSafe(stakingRaw),
      metadataURI: typeof metadataRaw === 'string' ? metadataRaw : '',
      brandingURI: typeof brandingRaw === 'string' ? brandingRaw : '',
      version: versionNumber,
      tierId: tierNumber,
      feeSplits,
      antiWhaleConfig,
      totalFeeBps: toNumberSafe(totalFeeBpsRaw, 0),
      liquidityAccumulator: formatUnits(liquidityAccumulatorValue, decimals),
      liquidityAccumulatorRaw: liquidityAccumulatorValue,
      liquidityRouter: toAddressSafe(liquidityRouterRaw),
      liquidityPairToken: toAddressSafe(liquidityPairTokenRaw),
      liquidityBps: toNumberSafe(liquidityBpsRaw, 0),
      stakingReserve: formatUnits(stakingReserveValue, decimals),
      stakingReserveRaw: stakingReserveValue,
      record,
    } satisfies FactoryTokenDetails;
  });
}

export function useFactoryTokens(factoryAddress?: Address) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });

  return useQuery<FactoryTokenDetails[]>({
    queryKey: ['factoryTokens', chainId, address, factoryAddress],
    enabled: Boolean(address && factoryAddress && publicClient),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!address || !factoryAddress || !publicClient) return [];

      const client = publicClient as PublicClientType;
      const totalTokensRaw = await client.readContract({
        abi: TokenFactoryABI,
        address: factoryAddress,
        functionName: 'totalTokens',
      });

      const totalTokens = Number(totalTokensRaw ?? 0n);
      if (!Number.isFinite(totalTokens) || totalTokens <= 0) return [];

      const entries = await fetchTokenRecords(client, factoryAddress, totalTokens);
      const normalizedAddress = address.toLowerCase();
      const filtered = entries.filter((entry) => entry.record.creator.toLowerCase() === normalizedAddress);
      if (filtered.length === 0) return [];

      const details = await fetchTokenDetails(client, filtered);
      return details.sort((a, b) => b.record.createdAt - a.record.createdAt);
    },
  });
}
