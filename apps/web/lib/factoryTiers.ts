import type { Address } from "viem";

export enum FactoryFeature {
  Cap = "cap",
  Roles = "roles",
  Distribution = "distribution",
  Metadata = "metadata",
  Mint = "mint",
  Fees = "fees",
  AutoLiquidity = "autoLiquidity",
  AntiWhale = "antiWhale",
  Staking = "staking",
  Vesting = "vesting",
  Governance = "governance",
  Bridge = "bridge",
  Branding = "branding",
  Lock = "lock",
  PlatformVesting = "platformVesting",
}

export const FEATURE_BITS: Record<FactoryFeature, bigint> = {
  [FactoryFeature.Cap]: 1n << 0n,
  [FactoryFeature.Roles]: 1n << 1n,
  [FactoryFeature.Distribution]: 1n << 2n,
  [FactoryFeature.Metadata]: 1n << 3n,
  [FactoryFeature.Mint]: 1n << 4n,
  [FactoryFeature.Fees]: 1n << 5n,
  [FactoryFeature.AutoLiquidity]: 1n << 6n,
  [FactoryFeature.AntiWhale]: 1n << 7n,
  [FactoryFeature.Staking]: 1n << 8n,
  [FactoryFeature.Vesting]: 1n << 9n,
  [FactoryFeature.Governance]: 1n << 10n,
  [FactoryFeature.Bridge]: 1n << 11n,
  [FactoryFeature.Branding]: 1n << 12n,
  [FactoryFeature.Lock]: 1n << 13n,
  [FactoryFeature.PlatformVesting]: 1n << 14n,
};

export type TierDefinition = {
  id: number;
  name: string;
  priceWei: bigint;
  blurb: string;
  features: bigint;
};

const BASE_FEATURES = FEATURE_BITS[FactoryFeature.Cap] |
  FEATURE_BITS[FactoryFeature.Roles] |
  FEATURE_BITS[FactoryFeature.Distribution] |
  FEATURE_BITS[FactoryFeature.Metadata];

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: 1,
    name: "Basic",
    priceWei: 10_000_000_000_000_000n, // 0.01 ether
    blurb: "Mint/burn/pause with single-owner distribution.",
    features: 0n,
  },
  {
    id: 2,
    name: "Advanced",
    priceWei: 15_000_000_000_000_000n, // 0.015 ether
    blurb: "Adds caps, multi-recipient distribution and metadata.",
    features: BASE_FEATURES,
  },
  {
    id: 3,
    name: "Pro",
    priceWei: 25_000_000_000_000_000n, // 0.025 ether
    blurb: "Enable fee routing, auto-liquidity and anti-whale tools.",
    features:
      BASE_FEATURES |
      FEATURE_BITS[FactoryFeature.Fees] |
      FEATURE_BITS[FactoryFeature.AutoLiquidity] |
      FEATURE_BITS[FactoryFeature.AntiWhale] |
      FEATURE_BITS[FactoryFeature.Staking] |
      FEATURE_BITS[FactoryFeature.Vesting] |
      FEATURE_BITS[FactoryFeature.Lock] |
      FEATURE_BITS[FactoryFeature.PlatformVesting],
  },
  {
    id: 4,
    name: "DAO",
    priceWei: 35_000_000_000_000_000n, // 0.035 ether
    blurb: "Adds vesting, governance voting and bridge operators.",
    features:
      BASE_FEATURES |
      FEATURE_BITS[FactoryFeature.Fees] |
      FEATURE_BITS[FactoryFeature.AutoLiquidity] |
      FEATURE_BITS[FactoryFeature.AntiWhale] |
      FEATURE_BITS[FactoryFeature.Staking] |
      FEATURE_BITS[FactoryFeature.Vesting] |
      FEATURE_BITS[FactoryFeature.Governance] |
      FEATURE_BITS[FactoryFeature.Bridge] |
      FEATURE_BITS[FactoryFeature.Lock] |
      FEATURE_BITS[FactoryFeature.PlatformVesting],
  },
  {
    id: 5,
    name: "Premium",
    priceWei: 40_000_000_000_000_000n, // 0.04 ether
    blurb: "Full suite: governance, liquidity, staking and branding.",
    features:
      BASE_FEATURES |
      FEATURE_BITS[FactoryFeature.Fees] |
      FEATURE_BITS[FactoryFeature.AutoLiquidity] |
      FEATURE_BITS[FactoryFeature.AntiWhale] |
      FEATURE_BITS[FactoryFeature.Staking] |
      FEATURE_BITS[FactoryFeature.Vesting] |
      FEATURE_BITS[FactoryFeature.Governance] |
      FEATURE_BITS[FactoryFeature.Bridge] |
      FEATURE_BITS[FactoryFeature.Branding] |
      FEATURE_BITS[FactoryFeature.Lock] |
      FEATURE_BITS[FactoryFeature.PlatformVesting],
  },
  {
    id: 6,
    name: "Elite",
    priceWei: 100_000_000_000_000_000n, // 0.1 ether
    blurb: "Unlock minting alongside every premium feature.",
    features:
      BASE_FEATURES |
      FEATURE_BITS[FactoryFeature.Mint] |
      FEATURE_BITS[FactoryFeature.Fees] |
      FEATURE_BITS[FactoryFeature.AutoLiquidity] |
      FEATURE_BITS[FactoryFeature.AntiWhale] |
      FEATURE_BITS[FactoryFeature.Staking] |
      FEATURE_BITS[FactoryFeature.Vesting] |
      FEATURE_BITS[FactoryFeature.Governance] |
      FEATURE_BITS[FactoryFeature.Bridge] |
      FEATURE_BITS[FactoryFeature.Branding] |
      FEATURE_BITS[FactoryFeature.Lock] |
      FEATURE_BITS[FactoryFeature.PlatformVesting],
  },
];

export function getTierDefinition(tierId: number): TierDefinition | undefined {
  return TIER_DEFINITIONS.find((tier) => tier.id === tierId);
}

export function tierAllowsFeature(tier: TierDefinition | undefined, feature: FactoryFeature): boolean {
  if (!tier) return false;
  if (tier.features === 0n) return false;
  return (tier.features & FEATURE_BITS[feature]) !== 0n;
}

export const FEATURE_DESCRIPTIONS: Record<FactoryFeature, string> = {
  [FactoryFeature.Cap]: "Supply cap enforcement",
  [FactoryFeature.Roles]: "Custom access-control roles",
  [FactoryFeature.Distribution]: "Multiple recipients & vesting",
  [FactoryFeature.Metadata]: "Custom metadata URI",
  [FactoryFeature.Mint]: "Mint new tokens on demand",
  [FactoryFeature.Fees]: "Dynamic fee routing",
  [FactoryFeature.AutoLiquidity]: "Auto-liquidity reserve",
  [FactoryFeature.AntiWhale]: "Anti-whale rules",
  [FactoryFeature.Staking]: "Staking reserve manager",
  [FactoryFeature.Vesting]: "Team vesting schedules",
  [FactoryFeature.Governance]: "ERC20Votes governance",
  [FactoryFeature.Bridge]: "Bridge operator roles",
  [FactoryFeature.Branding]: "Branding URI support",
  [FactoryFeature.Lock]: "Lock liquidity / team tokens",
  [FactoryFeature.PlatformVesting]: "Platform-managed vesting lockers",
};

export type DistributionEntry = {
  account: string;
  amount: string;
  vesting?: boolean;
  vestingStart?: string;
  cliff?: string;
  duration?: string;
  revocable?: boolean;
};

export type FeeSplitEntry = {
  feeType: number;
  bps: string;
  recipient: string;
};

export type AntiWhaleState = {
  enabled: boolean;
  maxTxAmount: string;
  maxWalletAmount: string;
  cooldownBlocks: string;
};

export type WizardTokenInitState = {
  name: string;
  symbol: string;
  decimals: string;
  owner: string;
};

export type WizardTokenConfigState = {
  initialSupply: string;
  cap: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  governanceEnabled: boolean;
  autoLiquidityEnabled: boolean;
  antiWhaleEnabled: boolean;
  stakingEnabled: boolean;
  autoLiquidityBps: string;
  autoLiquidityRouter: string;
  autoLiquidityPairToken: string;
  stakingManager: string;
  metadataURI: string;
  brandingURI: string;
  fees: FeeSplitEntry[];
  initialDistribution: DistributionEntry[];
  minters: string;
  pausers: string;
  burners: string;
  bridgeOperators: string;
  antiWhale: AntiWhaleState;
};

export const DEFAULT_INIT_STATE: WizardTokenInitState = {
  name: "",
  symbol: "",
  decimals: "18",
  owner: "",
};

export const DEFAULT_CONFIG_STATE: WizardTokenConfigState = {
  initialSupply: "0",
  cap: "0",
  mintable: true,
  burnable: true,
  pausable: true,
  governanceEnabled: false,
  autoLiquidityEnabled: false,
  antiWhaleEnabled: false,
  stakingEnabled: false,
  autoLiquidityBps: "0",
  autoLiquidityRouter: "",
  autoLiquidityPairToken: "",
  stakingManager: "",
  metadataURI: "",
  brandingURI: "",
  fees: [],
  initialDistribution: [],
  minters: "",
  pausers: "",
  burners: "",
  bridgeOperators: "",
  antiWhale: {
    enabled: false,
    maxTxAmount: "0",
    maxWalletAmount: "0",
    cooldownBlocks: "0",
  },
};

export function parseAddresses(input: string): Address[] {
  return input
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter((item): item is Address => item.length > 0) as Address[];
}
