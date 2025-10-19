"use client";

import { FormEvent, useMemo, useState } from 'react';
import { Address, formatUnits, isAddress, parseUnits, zeroAddress } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { ERC20TemplateABI } from '../../../../lib/abi/ERC20Template';
import { TokenLockerABI } from '../../../../lib/abi/TokenLocker';
import { TokenVestingABI } from '../../../../lib/abi/TokenVesting';
import { FactoryTokenDetails } from '../../../../hooks/useFactoryTokens';
import { FactoryFeature, getTierDefinition, tierAllowsFeature } from '../../../../lib/factoryTiers';
import { getTokenLockerForChain, getTokenVestingForChain } from '../../../../lib/config';
import { useToast } from "../../../../components/ui/Toast";
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../../lib/i18n/LanguageContext';

const CHAIN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  97: "https://testnet.bscscan.com",
  137: "https://polygonscan.com",
  42161: "https://arbiscan.io",
};

const FEATURE_TRANSLATIONS = {
  [FactoryFeature.Cap]: 'tokenCard.features.cap',
  [FactoryFeature.Roles]: 'tokenCard.features.roles',
  [FactoryFeature.Distribution]: 'tokenCard.features.distribution',
  [FactoryFeature.Metadata]: 'tokenCard.features.metadata',
  [FactoryFeature.Mint]: 'tokenCard.features.mint',
  [FactoryFeature.Fees]: 'tokenCard.features.fees',
  [FactoryFeature.AutoLiquidity]: 'tokenCard.features.autoLiquidity',
  [FactoryFeature.AntiWhale]: 'tokenCard.features.antiWhale',
  [FactoryFeature.Staking]: 'tokenCard.features.staking',
  [FactoryFeature.Vesting]: 'tokenCard.features.vesting',
  [FactoryFeature.Governance]: 'tokenCard.features.governance',
  [FactoryFeature.Bridge]: 'tokenCard.features.bridge',
  [FactoryFeature.Branding]: 'tokenCard.features.branding',
  [FactoryFeature.Lock]: 'tokenCard.features.lock',
  [FactoryFeature.PlatformVesting]: 'tokenCard.features.platformVesting',
} as const;

type ActionField = {
  name: string;
  label: string;
  placeholder?: string;
  helper?: string;
  type?: "textarea" | "checkbox";
};

type ContractAction = {
  id: string;
  title: string;
  description: string;
  functionName: (typeof ERC20TemplateABI)[number]["name"];
  enabled: boolean;
  category: "primary" | "advanced";
  successTitle: string;
  failureTitle: string;
  fields?: ActionField[];
  defaults?: Partial<Record<string, string | boolean>>;
  prepare: (values: Record<string, string | boolean>) => any[];
};

type LockerEntry = {
  id: bigint;
  token: Address;
  amount: bigint;
  unlockTime: number;
  withdrawn: boolean;
};

type VestingEntry = {
  id: bigint;
  token: Address;
  funder: Address;
  beneficiary: Address;
  amount: bigint;
  released: bigint;
  releaseTime: number;
};

interface TokenCardProps {
  token: FactoryTokenDetails;
  chainId: number;
  factoryAddress?: Address;
  onRefresh: () => void;
}

function explorerLink(chainId: number, path: string) {
  const base = CHAIN_EXPLORERS[chainId];
  return base ? `${base}${path}` : undefined;
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function parseBigAmount(value: string | undefined, decimals: number, errorMessage: string) {
  const raw = (value ?? "").trim();
  if (!raw) throw new Error(errorMessage);
  return parseUnits(raw, decimals);
}

function formatTimestamp(seconds: number, fallback = "N/A") {
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return new Date(seconds * 1000).toLocaleString();
}

function toBigIntSafe(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export default function TokenCard({ token, chainId, factoryAddress, onRefresh }: TokenCardProps) {
  const { language, t } = useTranslation();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const tier = useMemo(() => getTierDefinition(token.record.tierId), [token.record.tierId]);
  const featureMap = useMemo(
    () =>
      Object.values(FactoryFeature).reduce<Record<string, boolean>>((acc, feature) => {
        acc[feature] = tierAllowsFeature(tier, feature as FactoryFeature);
        return acc;
      }, {}),
    [tier],
  );

  const locker = getTokenLockerForChain(chainId);
  const vesting = getTokenVestingForChain(chainId);
  const supportsLock = Boolean(locker && tierAllowsFeature(tier, FactoryFeature.Lock));
  const supportsPlatformVesting = Boolean(vesting && tierAllowsFeature(tier, FactoryFeature.PlatformVesting));

  const [lockForm, setLockForm] = useState<{ amount: string; unlock: string }>({ amount: '', unlock: '' });
  const [lockError, setLockError] = useState<string | undefined>();
  const [vestingRows, setVestingRows] = useState<Array<{ beneficiary: string; amount: string; release: string }>>([
    { beneficiary: '', amount: '', release: '' },
  ]);
  const [vestingError, setVestingError] = useState<string | undefined>();
  const [lockerActionError, setLockerActionError] = useState<string | undefined>();
  const [vestingActionError, setVestingActionError] = useState<string | undefined>();

  const actions: ContractAction[] = useMemo(() => {
    const d = token.decimals;
    const amountRequiredMsg = t('tokenCard.errors.amountRequired');
    const jsonRequiredMsg = t('tokenCard.errors.jsonRequired');
    const invalidJsonMsg = t('tokenCard.errors.invalidJson');
    const mustBeArrayMsg = t('tokenCard.errors.mustBeArray');
    const cooldownInvalidMsg = t('tokenCard.errors.cooldownInvalid');
    const addressInvalidMsg = t('tokenCard.errors.addressInvalid');
    const bpsOutOfRangeMsg = t('tokenCard.errors.bpsOutOfRange');
    const invalidEntryAt = (index: number) => t('tokenCard.errors.invalidEntry', { index });

    const parseAmount = (value: string | boolean | undefined) =>
      parseBigAmount(value?.toString(), d, amountRequiredMsg);

    const baseActions: ContractAction[] = [
      {
        id: 'mint',
        title: t('tokenCard.actions.mint.title'),
        description: t('tokenCard.actions.mint.description'),
        successTitle: t('tokenCard.actions.mint.success'),
        failureTitle: t('tokenCard.actions.mint.failure'),
        functionName: 'mint',
        category: 'primary',
        enabled: token.mintable,
        fields: [
          { name: 'to', label: t('tokenCard.fields.recipient'), placeholder: '0x...' },
          { name: 'amount', label: t('tokenCard.fields.amountSymbol', { symbol: token.symbol }), placeholder: '1000' },
        ],
        prepare: (values) => {
          const to = values.to?.toString().trim() ?? '';
          if (!isAddress(to)) throw new Error(t('tokenCard.errors.invalidAddress'));
          return [to as Address, parseAmount(values.amount)];
        },
      },
      {
        id: 'burn',
        title: t('tokenCard.actions.burn.title'),
        description: t('tokenCard.actions.burn.description'),
        successTitle: t('tokenCard.actions.burn.success'),
        failureTitle: t('tokenCard.actions.burn.failure'),
        functionName: 'burn',
        category: 'primary',
        enabled: token.burnable,
        fields: [{ name: 'amount', label: t('tokenCard.fields.amountSymbol', { symbol: token.symbol }), placeholder: '100' }],
        prepare: (values) => [parseAmount(values.amount)],
      },
      (() => {
        const key = token.paused ? 'unpause' : 'pause';
        return {
          id: 'pause',
          title: t(`tokenCard.actions.${key}.title` as const),
          description: t(`tokenCard.actions.${key}.description` as const),
          successTitle: t(`tokenCard.actions.${key}.success` as const),
          failureTitle: t(`tokenCard.actions.${key}.failure` as const),
          functionName: (token.paused ? 'unpause' : 'pause') as (typeof ERC20TemplateABI)[number]['name'],
          category: 'primary',
          enabled: token.pausable,
          prepare: () => [],
        } satisfies ContractAction;
      })(),
      {
        id: 'metadata',
        title: t('tokenCard.actions.metadata.title'),
        description: t('tokenCard.actions.metadata.description'),
        successTitle: t('tokenCard.actions.metadata.success'),
        failureTitle: t('tokenCard.actions.metadata.failure'),
        functionName: 'setMetadata',
        category: 'primary',
        enabled: true,
        fields: [
          { name: 'metadata', label: t('tokenCard.fields.metadataUri'), placeholder: 'https://.../metadata.json' },
          { name: 'branding', label: t('tokenCard.fields.brandingUri'), placeholder: 'https://.../brand.png' },
        ],
        defaults: { metadata: token.metadataURI ?? '', branding: token.brandingURI ?? '' },
        prepare: (values) => [values.metadata?.toString() ?? '', values.branding?.toString() ?? ''],
      },
      {
        id: 'fees',
        title: t('tokenCard.actions.fees.title'),
        description: t('tokenCard.actions.fees.description'),
        successTitle: t('tokenCard.actions.fees.success'),
        failureTitle: t('tokenCard.actions.fees.failure'),
        functionName: 'updateFees',
        category: 'advanced',
        enabled: featureMap[FactoryFeature.Fees],
        fields: [
          {
            name: 'fees',
            label: t('tokenCard.fields.feeJson'),
            type: 'textarea',
            helper: t('tokenCard.fields.feeHelper'),
          },
        ],
        prepare: (values) => {
          const raw = values.fees?.toString() ?? '';
          if (!raw) throw new Error(jsonRequiredMsg);
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (err) {
            throw new Error(invalidJsonMsg);
          }
          if (!Array.isArray(parsed)) throw new Error(mustBeArrayMsg);
          return [
            parsed.map((item: any, idx: number) => {
              const recipient = (item.recipient ?? zeroAddress).toString();
              if (!Number.isFinite(Number(item.feeType)) || !Number.isFinite(Number(item.bps)) || !isAddress(recipient)) {
                throw new Error(invalidEntryAt(idx));
              }
              return {
                feeType: Number(item.feeType),
                bps: Number(item.bps),
                recipient: recipient as Address,
              };
            }),
          ];
        },
      },
      {
        id: 'antiwhale',
        title: t('tokenCard.actions.antiwhale.title'),
        description: t('tokenCard.actions.antiwhale.description'),
        successTitle: t('tokenCard.actions.antiwhale.success'),
        failureTitle: t('tokenCard.actions.antiwhale.failure'),
        functionName: 'updateAntiWhale',
        category: 'advanced',
        enabled: token.antiWhale,
        fields: [
          { name: 'enabled', label: t('tokenCard.fields.enable'), type: 'checkbox' },
          { name: 'maxTx', label: t('tokenCard.fields.maxTx', { symbol: token.symbol }), placeholder: token.antiWhaleConfig.maxTxAmount?.toString() },
          {
            name: 'maxWallet',
            label: t('tokenCard.fields.maxWallet', { symbol: token.symbol }),
            placeholder: token.antiWhaleConfig.maxWalletAmount?.toString(),
          },
          { name: 'cooldown', label: t('tokenCard.fields.cooldown'), placeholder: token.antiWhaleConfig.cooldownBlocks?.toString() },
        ],
        defaults: {
          enabled: token.antiWhaleConfig.enabled,
          maxTx: token.antiWhaleConfig.maxTxAmount?.toString() ?? '',
          maxWallet: token.antiWhaleConfig.maxWalletAmount?.toString() ?? '',
          cooldown: token.antiWhaleConfig.cooldownBlocks?.toString() ?? '',
        },
        prepare: (values) => {
          const enabled = Boolean(values.enabled);
          const cooldown = Number(values.cooldown ?? 0);
          if (Number.isNaN(cooldown) || cooldown < 0) throw new Error(cooldownInvalidMsg);
          return [
            {
              enabled,
              maxTxAmount: enabled ? parseAmount(values.maxTx) : 0n,
              maxWalletAmount: enabled ? parseAmount(values.maxWallet) : 0n,
              cooldownBlocks: cooldown,
            },
          ];
        },
      },
      {
        id: 'renounceAllRoles',
        title: t('tokenCard.actions.renounceAllRoles.title'),
        description: t('tokenCard.actions.renounceAllRoles.description'),
        successTitle: t('tokenCard.actions.renounceAllRoles.success'),
        failureTitle: t('tokenCard.actions.renounceAllRoles.failure'),
        functionName: 'renounceAllRoles',
        category: 'advanced',
        enabled: Boolean(address),
        prepare: () => [] as const,
      },
    ];

    return baseActions;
  }, [token, featureMap, t, language, address]);

  const { addToast } = useToast();
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const [formState, setFormState] = useState<Record<string, Record<string, string | boolean | undefined>>>(() =>
    actions.reduce((acc, action) => {
      acc[action.id] = { ...(action.defaults ?? {}) };
      return acc;
    }, {} as Record<string, Record<string, string | boolean | undefined>>),
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleChange = (actionId: string, field: ActionField, value: string | boolean) => {
    setFormState((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] ?? {}),
        [field.name]: value,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>, action: ContractAction) => {
    event.preventDefault();
    if (!action.enabled || isPending || isConfirming) return;
    try {
      setFormErrors((prev) => ({ ...prev, [action.id]: "" }));
      const values = (formState[action.id] ?? {}) as Record<string, string | boolean>;
      const args = action.prepare(values);
      const hash = await writeContractAsync({
        abi: ERC20TemplateABI as any,
        address: token.address,
        functionName: action.functionName as any,
        args: args as any,
      } as any);
      addToast({
        kind: "success",
        title: `${action.title} submitted`,
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      onRefresh();
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Transaction failed";
      setFormErrors((prev) => ({ ...prev, [action.id]: message }));
      addToast({ kind: "error", title: `${action.title} failed`, message });
    }
  };

  const {
    data: lockerAllowance,
    refetch: refetchLockerAllowance,
    isFetching: isFetchingLockerAllowance,
  } = useReadContract({
    abi: ERC20TemplateABI as any,
    address: token.address,
    functionName: 'allowance',
    args: address && locker ? [address, locker] : undefined,
    query: {
      enabled: supportsLock && Boolean(address && locker),
    },
  });

  const {
    data: vestingAllowance,
    refetch: refetchVestingAllowance,
    isFetching: isFetchingVestingAllowance,
  } = useReadContract({
    abi: ERC20TemplateABI as any,
    address: token.address,
    functionName: 'allowance',
    args: address && vesting ? [address, vesting] : undefined,
    query: {
      enabled: supportsPlatformVesting && Boolean(address && vesting),
    },
  });

  const {
    data: lockerEntries = [],
    isLoading: isLoadingLockerEntries,
    isFetching: isFetchingLockerEntries,
    refetch: refetchLockerEntries,
  } = useQuery<LockerEntry[]>({
    queryKey: ['tokenLockerLocks', chainId, address, locker, token.address],
    enabled: supportsLock && Boolean(address && locker && publicClient),
    queryFn: async () => {
      if (!supportsLock || !address || !locker || !publicClient) return [];
      const ids = (await publicClient.readContract({
        abi: TokenLockerABI as any,
        address: locker,
        functionName: 'getLocksByOwner',
        args: [address],
      })) as readonly bigint[];
      if (!ids || ids.length === 0) return [];
      const contracts = ids.map((lockId) => ({
        abi: TokenLockerABI as any,
        address: locker,
        functionName: 'locks' as const,
        args: [lockId],
      }));
      const details = await publicClient.multicall({ contracts, allowFailure: false });
      const target = token.address.toLowerCase();
      return ids
        .map((lockId, index) => {
          const detail = details[index] as any;
          const tokenAddress = (detail?.token ?? detail?.[0]) as Address | undefined;
          if (!tokenAddress || tokenAddress.toLowerCase() !== target) return null;
          const amountValue = detail?.amount ?? detail?.[2];
          const unlockValue = detail?.unlockTime ?? detail?.[3];
          const withdrawnValue = detail?.withdrawn ?? detail?.[4];
          return {
            id: lockId,
            token: tokenAddress as Address,
            amount: toBigIntSafe(amountValue),
            unlockTime: Number(toBigIntSafe(unlockValue)),
            withdrawn: Boolean(withdrawnValue),
          } as LockerEntry;
        })
        .filter((entry): entry is LockerEntry => Boolean(entry));
    },
  });

  const {
    data: vestingEntries = [],
    isLoading: isLoadingVestingEntries,
    isFetching: isFetchingVestingEntries,
    refetch: refetchVestingEntries,
  } = useQuery<VestingEntry[]>({
    queryKey: ['tokenVestings', chainId, address, vesting, token.address],
    enabled: supportsPlatformVesting && Boolean(address && vesting && publicClient),
    queryFn: async () => {
      if (!supportsPlatformVesting || !address || !vesting || !publicClient) return [];
      const ids = (await publicClient.readContract({
        abi: TokenVestingABI as any,
        address: vesting,
        functionName: 'getVestingsByBeneficiary',
        args: [address],
      })) as readonly bigint[];
      if (!ids || ids.length === 0) return [];
      const contracts = ids.map((vestingId) => ({
        abi: TokenVestingABI as any,
        address: vesting,
        functionName: 'vestings' as const,
        args: [vestingId],
      }));
      const details = await publicClient.multicall({ contracts, allowFailure: false });
      const target = token.address.toLowerCase();
      return ids
        .map((vestingId, index) => {
          const detail = details[index] as any;
          const tokenAddress = (detail?.token ?? detail?.[0]) as Address | undefined;
          if (!tokenAddress || tokenAddress.toLowerCase() !== target) return null;
          const funder = (detail?.funder ?? detail?.[1]) as Address | undefined;
          const beneficiary = (detail?.beneficiary ?? detail?.[2]) as Address | undefined;
          const amountValue = detail?.amount ?? detail?.[3];
          const releasedValue = detail?.released ?? detail?.[4];
          const releaseValue = detail?.releaseTime ?? detail?.[5];
          const amount = toBigIntSafe(amountValue);
          const released = toBigIntSafe(releasedValue);
          if (amount === 0n || released >= amount) return null;
          return {
            id: vestingId,
            token: tokenAddress as Address,
            funder: (funder ?? zeroAddress) as Address,
            beneficiary: (beneficiary ?? zeroAddress) as Address,
            amount,
            released,
            releaseTime: Number(toBigIntSafe(releaseValue)),
          } as VestingEntry;
        })
        .filter((entry): entry is VestingEntry => Boolean(entry));
    },
  });

  const isLockerListLoading = isLoadingLockerEntries || isFetchingLockerEntries;
  const isVestingListLoading = isLoadingVestingEntries || isFetchingVestingEntries;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const desiredLockAmount = (() => {
    if (!supportsLock || !locker || !lockForm.amount) return undefined;
    try {
      return parseBigAmount(lockForm.amount, token.decimals);
    } catch {
      return undefined;
    }
  })();

  const desiredVestingTotal = (() => {
    if (!supportsPlatformVesting || !vesting) return undefined;
    try {
      return vestingRows.reduce<bigint>((acc, row) => {
        if (!row.amount) return acc;
        return acc + parseBigAmount(row.amount, token.decimals);
      }, 0n);
    } catch {
      return undefined;
    }
  })();

  const needsLockerApproval = Boolean(
    supportsLock &&
      locker &&
      desiredLockAmount !== undefined &&
      lockerAllowance !== undefined &&
      lockerAllowance < desiredLockAmount,
  );

  const needsVestingApproval = Boolean(
    supportsPlatformVesting &&
      vesting &&
      desiredVestingTotal !== undefined &&
      vestingAllowance !== undefined &&
      vestingAllowance < desiredVestingTotal,
  );

  const handleApprove = async (type: 'locker' | 'vesting', spender: Address, amount: bigint) => {
    const invalidMessage = t(
      type === 'locker' ? 'tokenCard.locker.invalidApprovalAmount' : 'tokenCard.vesting.invalidApprovalAmount',
    );
    if (amount <= 0n) {
      if (type === 'locker') setLockError(invalidMessage);
      else setVestingError(invalidMessage);
      addToast({ kind: 'error', title: t('tokenCard.misc.approvalFailed'), message: invalidMessage });
      return;
    }
    try {
      const hash = await writeContractAsync({
        abi: ERC20TemplateABI as any,
        address: token.address,
        functionName: 'approve' as any,
        args: [spender, amount] as any,
      });
      addToast({
        kind: 'success',
        title: t('tokenCard.misc.approvalSubmitted'),
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      if (type === 'locker') {
        await refetchLockerAllowance();
        setLockError(undefined);
      } else {
        await refetchVestingAllowance();
        setVestingError(undefined);
      }
    } catch (err: any) {
      const fallback = t(type === 'locker' ? 'tokenCard.locker.approvalError' : 'tokenCard.vesting.approvalError');
      const message = err?.shortMessage || err?.message || fallback;
      if (type === 'locker') setLockError(message);
      else setVestingError(message);
      addToast({ kind: 'error', title: t('tokenCard.misc.approvalFailed'), message });
      throw err;
    }
  };

  const handleWithdraw = async (entry: LockerEntry) => {
    if (!supportsLock || !locker) return;
    const current = Math.floor(Date.now() / 1000);
    if (entry.withdrawn) {
      setLockerActionError(t('tokenCard.locker.alreadyWithdrawn'));
      return;
    }
    if (entry.unlockTime > current) {
      setLockerActionError(t('tokenCard.locker.notReady'));
      return;
    }
    try {
      setLockerActionError(undefined);
      const hash = await writeContractAsync({
        abi: TokenLockerABI as any,
        address: locker,
        functionName: 'withdraw' as any,
        args: [entry.id] as any,
      });
      addToast({
        kind: 'success',
        title: t('tokenCard.locker.withdrawalSuccess'),
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      await refetchLockerEntries();
      onRefresh();
    } catch (err: any) {
      const fallback = t('tokenCard.locker.withdrawalError');
      const message = err?.shortMessage || err?.message || fallback;
      setLockerActionError(message);
      addToast({ kind: 'error', title: t('tokenCard.locker.withdrawalFailure'), message });
    }
  };

  const handleRelease = async (entry: VestingEntry) => {
    if (!supportsPlatformVesting || !vesting) return;
    const current = Math.floor(Date.now() / 1000);
    if (entry.released >= entry.amount) {
      setVestingActionError(t('tokenCard.vesting.alreadyReleased'));
      return;
    }
    if (entry.releaseTime > current) {
      setVestingActionError(t('tokenCard.vesting.notReady'));
      return;
    }
    try {
      setVestingActionError(undefined);
      const hash = await writeContractAsync({
        abi: TokenVestingABI as any,
        address: vesting,
        functionName: 'release' as any,
        args: [entry.id] as any,
      });
      addToast({
        kind: 'success',
        title: t('tokenCard.vesting.releaseSuccess'),
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      await refetchVestingEntries();
      onRefresh();
    } catch (err: any) {
      const fallback = t('tokenCard.vesting.releaseError');
      const message = err?.shortMessage || err?.message || fallback;
      setVestingActionError(message);
      addToast({ kind: 'error', title: t('tokenCard.vesting.releaseFailure'), message });
    }
  };

  const handleLockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supportsLock || !locker) return;
    try {
      setLockError(undefined);
      const amount = parseBigAmount(lockForm.amount, token.decimals);
      const { data: latestAllowance } = await refetchLockerAllowance();
      if (!latestAllowance || latestAllowance < amount) {
        try {
          await handleApprove('locker', locker, amount);
          setLockError(t('tokenCard.locker.approvalPrompt'));
        } catch (approveError: any) {
          const message =
            approveError?.shortMessage || approveError?.message || t('tokenCard.locker.approvalError');
          setLockError(message);
        }
        return;
      }
      const parsed = Date.parse(lockForm.unlock);
      if (Number.isNaN(parsed)) throw new Error("Provide a valid unlock datetime");
      const releaseSeconds = Math.floor(parsed / 1000);
      if (releaseSeconds <= Math.floor(Date.now() / 1000)) throw new Error("Unlock time must be in the future");

      const hash = await writeContractAsync({
        abi: TokenLockerABI as any,
        address: locker,
        functionName: "lock" as any,
        args: [token.address, amount, BigInt(releaseSeconds)] as any,
      });

      addToast({
        kind: "success",
        title: "Lock scheduled",
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      setLockForm({ amount: "", unlock: "" });
      onRefresh();
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to lock tokens";
      setLockError(message);
      addToast({ kind: "error", title: "Lock failed", message });
    }
  };

  const updateVestingRow = (index: number, key: "beneficiary" | "amount" | "release", value: string) => {
    setVestingRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  };

  const addVestingRow = () => {
    setVestingRows((prev) => [...prev, { beneficiary: "", amount: "", release: "" }]);
  };

  const removeVestingRow = (index: number) => {
    setVestingRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleVestingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supportsPlatformVesting || !vesting) return;
    try {
      setVestingError(undefined);
      if (vestingRows.length === 0) throw new Error("Add at least one vesting row");

      const prepared = vestingRows.map((row, index) => {
        if (!isAddress(row.beneficiary)) {
          throw new Error(`Row ${index + 1}: invalid address`);
        }
        const amount = parseBigAmount(row.amount, token.decimals);
        const parsed = Date.parse(row.release);
        if (Number.isNaN(parsed)) {
          throw new Error(`Row ${index + 1}: invalid unlock datetime`);
        }
        const releaseSeconds = Math.floor(parsed / 1000);
        if (releaseSeconds <= Math.floor(Date.now() / 1000)) {
          throw new Error(`Row ${index + 1}: unlock must be in the future`);
        }
        return {
          beneficiary: row.beneficiary as Address,
          amount,
          releaseTime: BigInt(releaseSeconds),
        };
      });

      const totalRequested = prepared.reduce<bigint>((acc, row) => acc + row.amount, 0n);
      const { data: latestAllowance } = await refetchVestingAllowance();
      if (!latestAllowance || latestAllowance < totalRequested) {
        try {
          await handleApprove('vesting', vesting, totalRequested);
          setVestingError(t('tokenCard.vesting.approvalPrompt'));
        } catch (approveError: any) {
          const message =
            approveError?.shortMessage || approveError?.message || t('tokenCard.vesting.approvalError');
          setVestingError(message);
        }
        return;
      }

      const hash = await writeContractAsync({
        abi: TokenVestingABI as any,
        address: vesting,
        functionName: "createVestingBatch" as any,
        args: [token.address, prepared] as any,
      });

      addToast({
        kind: "success",
        title: "Vesting batch submitted",
        message: hash,
        linkHref: explorerLink(chainId, `/tx/${hash}`),
      });
      setVestingRows([{ beneficiary: "", amount: "", release: "" }]);
      onRefresh();
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Unable to create vesting batch";
      setVestingError(message);
      addToast({ kind: "error", title: "Vesting failed", message });
    }
  };

  const primary = actions.filter((action) => action.category === "primary");
  const advanced = actions.filter((action) => action.category === "advanced");

  const downloadFeesTemplate = () => {
    const template = {
      $schema: "https://universwap.app/token-factory/fees.schema.json",
      description: "Example fee configuration. Remove or update comments before uploading.",
      fees: [
        {
          feeType: 0,
          bps: 100,
          recipient: "0x0000000000000000000000000000000000000000",
          $comment: "Platform fee (1%) routed to treasury.",
        },
        {
          feeType: 1,
          bps: 50,
          recipient: "0x0000000000000000000000000000000000000000",
          $comment: "Referral fee (0.5%) routed to partner wallet.",
        },
      ],
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "factory-fees-template.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <article className="grid gap-5 rounded-xl border border-neutral-light/15 bg-neutral-dark/40 p-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold text-neutral-light">{token.name}</h3>
          <span className="rounded-full bg-white/10 px-2 py-1 text-xs uppercase text-neutral-light/80">{token.symbol}</span>
          <span className="text-xs text-neutral-light/60">Tier {token.record.tierId}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-neutral-light/70">
          <span>Total supply: {token.totalSupply}</span>
          {token.cap && <span>Cap: {token.cap}</span>}
          <span>Decimals: {token.decimals}</span>
          <span>Created: {new Date(token.record.createdAt * 1000).toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-primary">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(token.address)}
            className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20"
          >
            Copy address
          </button>
          {explorerLink(chainId, `/address/${token.address}`) && (
            <a
              href={explorerLink(chainId, `/address/${token.address}`) ?? "#"}
              className="text-[11px] text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              View on explorer
            </a>
          )}
        </div>
      </header>

      <section className="grid gap-2 rounded border border-neutral-light/10 bg-white/5 p-4 text-xs text-neutral-light/80">
        <h4 className="text-sm font-semibold text-neutral-light">Capabilities</h4>
        <div className="grid gap-1">
          {Object.values(FactoryFeature).map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${featureMap[feature] ? "bg-green-400" : "bg-red-500/60"}`} />
              <span>{t(FEATURE_TRANSLATIONS[feature as FactoryFeature])}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {primary.map((action) => (
            <form
              key={action.id}
              onSubmit={(event) => handleSubmit(event, action)}
              className="grid h-full gap-3 rounded border border-white/10 bg-white/5 p-4 text-sm text-neutral-light"
            >
              <header className="grid gap-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-light">{action.title}</h4>
                  <span className="text-xs text-neutral-light/60">{action.description}</span>
                </div>
              </header>

              {action.fields?.map((field) => {
                const fieldState = formState[action.id] ?? {};
                if (field.type === "textarea") {
                  return (
                    <label key={field.name} className="grid gap-1 text-xs text-neutral-light/80">
                      {field.label}
                      <textarea
                        value={(fieldState[field.name] as string) ?? ""}
                        onChange={(event) => handleChange(action.id, field, event.target.value)}
                        className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                        rows={3}
                      />
                      {field.helper && <span className="text-[11px] text-neutral-light/60">{field.helper}</span>}
                      {action.id === "fees" && (
                        <button
                          type="button"
                          onClick={downloadFeesTemplate}
                          className="w-fit rounded bg-primary/20 px-2 py-1 text-[11px] text-primary hover:bg-primary/30"
                        >
                          Download example JSON
                        </button>
                      )}
                    </label>
                  );
                }

                if (field.type === "checkbox") {
                  return (
                    <label key={field.name} className="flex items-center gap-2 text-xs text-neutral-light/80">
                      <input
                        type="checkbox"
                        checked={Boolean(fieldState[field.name])}
                        onChange={(event) => handleChange(action.id, field, event.target.checked)}
                        className="h-4 w-4 rounded border border-white/20 bg-neutral-dark/60"
                      />
                      {field.label}
                    </label>
                  );
                }

                return (
                  <label key={field.name} className="grid gap-1 text-xs text-neutral-light/80">
                    {field.label}
                    <input
                      value={(fieldState[field.name] as string) ?? ""}
                      onChange={(event) => handleChange(action.id, field, event.target.value)}
                      className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                      placeholder={field.placeholder}
                    />
                    {field.helper && <span className="text-[11px] text-neutral-light/60">{field.helper}</span>}
                  </label>
                );
              })}

              {formErrors[action.id] && (
                <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
                  {formErrors[action.id]}
                </div>
              )}

              <div className="mt-auto flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!action.enabled || isPending || isConfirming}
                  className="rounded bg-primary px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-50"
                >
                  {action.title}
                </button>
                {action.enabled ? null : <span className="text-xs text-neutral-light/50">Feature disabled</span>}
              </div>
            </form>
          ))}
        </div>
      </section>

      {advanced.length > 0 && (
        <section className="grid gap-4">
          <h4 className="text-sm font-semibold text-neutral-light">Advanced actions</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {advanced.map((action) => (
              <form
                key={action.id}
                onSubmit={(event) => handleSubmit(event, action)}
                className="grid h-full gap-3 rounded border border-white/10 bg-white/5 p-4 text-sm text-neutral-light"
              >
                <header className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-neutral-light">{action.title}</h5>
                    <span className="text-xs text-neutral-light/60">{action.description}</span>
                  </div>
                </header>

                {action.fields?.map((field) => {
                  const fieldState = formState[action.id] ?? {};
                  if (field.type === "textarea") {
                    return (
                      <label key={field.name} className="grid gap-1 text-xs text-neutral-light/80">
                        {field.label}
                        <textarea
                          value={(fieldState[field.name] as string) ?? ""}
                          onChange={(event) => handleChange(action.id, field, event.target.value)}
                          className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                          rows={3}
                        />
                        {field.helper && <span className="text-[11px] text-neutral-light/60">{field.helper}</span>}
                        {action.id === "fees" && (
                          <button
                            type="button"
                            onClick={downloadFeesTemplate}
                            className="w-fit rounded bg-primary/20 px-2 py-1 text-[11px] text-primary hover:bg-primary/30"
                          >
                            Download example JSON
                          </button>
                        )}
                      </label>
                    );
                  }

                  if (field.type === "checkbox") {
                    return (
                      <label key={field.name} className="flex items-center gap-2 text-xs text-neutral-light/80">
                        <input
                          type="checkbox"
                          checked={Boolean(fieldState[field.name])}
                          onChange={(event) => handleChange(action.id, field, event.target.checked)}
                          className="h-4 w-4 rounded border border-white/20 bg-neutral-dark/60"
                        />
                        {field.label}
                      </label>
                    );
                  }

                  return (
                    <label key={field.name} className="grid gap-1 text-xs text-neutral-light/80">
                      {field.label}
                      <input
                        value={(fieldState[field.name] as string) ?? ""}
                        onChange={(event) => handleChange(action.id, field, event.target.value)}
                        className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                        placeholder={field.placeholder}
                      />
                      {field.helper && <span className="text-[11px] text-neutral-light/60">{field.helper}</span>}
                    </label>
                  );
                })}

                {formErrors[action.id] && (
                  <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
                    {formErrors[action.id]}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!action.enabled || isPending || isConfirming}
                    className="rounded bg-primary px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-50"
                  >
                    {action.title}
                  </button>
                  {action.enabled ? null : <span className="text-xs text-neutral-light/50">Feature disabled</span>}
                </div>
              </form>
            ))}
          </div>
        </section>
      )}

      {supportsLock && locker && (
        <section className="grid gap-3 rounded border border-neutral-light/10 bg-white/5 p-4">
          <header className="flex items-center justify-between">
            <div className="grid gap-1">
              <h4 className="text-sm font-semibold text-neutral-light">{t('tokenCard.locker.title')}</h4>
              <span className="text-xs text-neutral-light/60">{t('tokenCard.locker.description')}</span>
            </div>
          </header>

          <form onSubmit={handleLockSubmit} className="grid gap-3 text-sm text-neutral-light">
            <label className="grid gap-1 text-xs text-neutral-light/80">
              {t('tokenCard.locker.amountLabel', { symbol: token.symbol })}
              <input
                value={lockForm.amount}
                onChange={(event) => setLockForm((prev) => ({ ...prev, amount: event.target.value }))}
                className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                placeholder="1000"
              />
            </label>

            <label className="grid gap-1 text-xs text-neutral-light/80">
              {t('tokenCard.locker.unlockLabel')}
              <input
                type="datetime-local"
                value={lockForm.unlock}
                onChange={(event) => setLockForm((prev) => ({ ...prev, unlock: event.target.value }))}
                className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
              />
            </label>

            {lockError && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{lockError}</div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending || isConfirming || isFetchingLockerAllowance}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-50"
              >
                {t('tokenCard.locker.lockButton')}
              </button>
              {needsLockerApproval && (
                <button
                  type="button"
                  onClick={() => {
                    if (!desiredLockAmount || desiredLockAmount <= 0n) {
                      const msg = t('tokenCard.locker.invalidApprovalAmount');
                      setLockError(msg);
                      return;
                    }
                    handleApprove('locker', locker, desiredLockAmount);
                  }}
                  className="rounded bg-white/10 px-3 py-1 text-xs text-neutral-light hover:bg-white/15"
                >
                  {t('tokenCard.locker.approveButton')}
                </button>
              )}
              <span className="text-xs text-neutral-light/60">{t('tokenCard.locker.contractLabel')}: {shorten(locker)}</span>
            </div>
          </form>

          <div className="grid gap-2 rounded border border-white/10 bg-neutral-dark/40 p-3 text-xs text-neutral-light/90">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-neutral-light/60">{t('tokenCard.locker.pendingTitle')}</span>
              {isLockerListLoading ? <span className="text-[11px] text-neutral-light/60">{t('tokenCard.locker.loading')}</span> : null}
            </div>

            {lockerActionError && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{lockerActionError}</div>
            )}

            {lockerEntries.length === 0 ? (
              <span className="text-[11px] text-neutral-light/60">{t('tokenCard.locker.empty')}</span>
            ) : (
              <div className="grid gap-2">
                {lockerEntries.map((entry) => {
                  const canWithdraw = !entry.withdrawn && entry.unlockTime <= nowSeconds;
                  return (
                    <div key={entry.id.toString()} className="grid gap-1 rounded border border-white/10 bg-white/5 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span>ID #{entry.id.toString()}</span>
                        <span>{t('tokenCard.locker.entryAmount')}: {formatUnits(entry.amount, token.decimals)} {token.symbol}</span>
                        <span>{t('tokenCard.locker.entryUnlock')}: {formatTimestamp(entry.unlockTime)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-neutral-light">{t('tokenCard.locker.statusLabel')}: {entry.withdrawn ? t('tokenCard.statuses.withdrawn') : entry.unlockTime > nowSeconds ? t('tokenCard.statuses.locked') : t('tokenCard.statuses.available')}</span>
                        <button
                          type="button"
                          className="rounded bg-primary/20 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/30 disabled:opacity-40"
                          disabled={!canWithdraw || isPending || isConfirming}
                          onClick={() => handleWithdraw(entry)}
                        >
                          {t('tokenCard.locker.withdrawButton')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {supportsPlatformVesting && vesting && (
        <section className="grid gap-3 rounded border border-neutral-light/10 bg-white/5 p-4">
          <header className="flex items-center justify-between">
            <div className="grid gap-1">
              <h4 className="text-sm font-semibold text-neutral-light">Platform vesting</h4>
              <span className="text-xs text-neutral-light/60">
                Create single-release vesting batches managed by the platform contract.
              </span>
            </div>
          </header>

          <form onSubmit={handleVestingSubmit} className="grid gap-4 text-sm text-neutral-light">
            <div className="grid gap-3">
              {vestingRows.map((row, index) => (
                <div key={index} className="grid gap-3 rounded border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-light/60">
                    <span>Beneficiary #{index + 1}</span>
                    {vestingRows.length > 1 && (
                      <button
                        type="button"
                        className="text-[11px] text-red-300 hover:text-red-200"
                        onClick={() => removeVestingRow(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="grid gap-1 text-xs text-neutral-light/80">
                    Address
                    <input
                      value={row.beneficiary}
                      onChange={(event) => updateVestingRow(index, "beneficiary", event.target.value)}
                      className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                      placeholder="0x..."
                    />
                  </label>

                  <label className="grid gap-1 text-xs text-neutral-light/80">
                    Amount ({token.symbol})
                    <input
                      value={row.amount}
                      onChange={(event) => updateVestingRow(index, "amount", event.target.value)}
                      className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                      placeholder="5000"
                    />
                  </label>

                  <label className="grid gap-1 text-xs text-neutral-light/80">
                    Release date
                    <input
                      type="datetime-local"
                      value={row.release}
                      onChange={(event) => updateVestingRow(index, "release", event.target.value)}
                      className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addVestingRow}
                className="rounded bg-white/10 px-3 py-1 text-xs text-neutral-light hover:bg-white/15"
              >
                Add beneficiary
              </button>
              <span className="text-xs text-neutral-light/60">Contract: {shorten(vesting)}</span>
            </div>

            {vestingError && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{vestingError}</div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending || isConfirming || isFetchingVestingAllowance}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-neutral-dark disabled:opacity-50"
              >
                Create vesting batch
              </button>
              {needsVestingApproval && vesting && (
                <button
                  type="button"
                  onClick={() => {
                    if (!desiredVestingTotal || desiredVestingTotal <= 0n) {
                      setVestingError('Enter valid amounts before approving.');
                      return;
                    }
                    handleApprove('vesting', vesting, desiredVestingTotal);
                  }}
                  className="rounded bg-white/10 px-3 py-1 text-xs text-neutral-light hover:bg-white/15"
                >
                  {t('tokenCard.vesting.approveButton')}
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 rounded border border-white/10 bg-neutral-dark/40 p-3 text-xs text-neutral-light/90">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-neutral-light/60">Your claimable vestings</span>
              {isVestingListLoading ? <span className="text-[11px] text-neutral-light/60">Loading…</span> : null}
            </div>

            {vestingActionError && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{vestingActionError}</div>
            )}

            {vestingEntries.length === 0 ? (
              <span className="text-[11px] text-neutral-light/60">No pending vestings for this token.</span>
            ) : (
              <div className="grid gap-2">
                {vestingEntries.map((entry) => {
                  const pending = entry.amount - entry.released;
                  const canRelease = pending > 0n && entry.releaseTime <= nowSeconds;
                  return (
                    <div key={entry.id.toString()} className="grid gap-1 rounded border border-white/10 bg-white/5 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span>ID #{entry.id.toString()}</span>
                        <span>Pending: {formatUnits(pending, token.decimals)} {token.symbol}</span>
                        <span>Release: {formatTimestamp(entry.releaseTime)}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-light/60">
                        <span>Funder: {shorten(entry.funder)}</span>
                        <span>Beneficiary: {shorten(entry.beneficiary)}</span>
                        <button
                          type="button"
                          className="rounded bg-primary/20 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/30 disabled:opacity-40"
                          disabled={!canRelease || isPending || isConfirming}
                          onClick={() => handleRelease(entry)}
                        >
                          Claim
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="grid gap-2 rounded border border-neutral-light/10 bg-white/5 p-4 text-xs text-neutral-light/70">
        <div className="flex flex-wrap gap-3">
          <span>Fee BPS: {token.totalFeeBps}</span>
          <span>Liquidity reserve: {token.liquidityAccumulator}</span>
          <span>Staking reserve: {token.stakingReserve}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <span>Router: {token.liquidityRouter ? shorten(token.liquidityRouter) : "—"}</span>
          <span>Pair token: {token.liquidityPairToken ? shorten(token.liquidityPairToken) : "—"}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <span>Factory: {factoryAddress ? shorten(factoryAddress) : "—"}</span>
          <span>Token: {shorten(token.address)}</span>
        </div>
      </footer>
    </article>
  );
}
