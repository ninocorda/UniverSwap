"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address, isAddress, parseUnits, zeroAddress } from "viem";
import { TokenFactoryABI } from "../../lib/abi/TokenFactory";
import { getTokenFactoryForChain } from "../../lib/config";
import {
  DEFAULT_CONFIG_STATE,
  DEFAULT_INIT_STATE,
  FEATURE_DESCRIPTIONS,
  FactoryFeature,
  TIER_DEFINITIONS,
  tierAllowsFeature,
  type DistributionEntry,
  type WizardTokenConfigState,
  type WizardTokenInitState,
  parseAddresses,
} from "../../lib/factoryTiers";
import { useToast } from "../../components/ui/Toast";

type Step = "tier" | "details" | "config" | "review";

type VestingFormState = {
  start: string;
  cliffDays: string;
  durationDays: string;
  revocable: boolean;
};

function formatBNB(value: bigint): string {
  return (Number(value) / 1e18).toFixed(3);
}

function parseBigInt(input: string, decimals = 18): bigint {
  if (!input) return 0n;
  try {
    return parseUnits(input, decimals);
  } catch {
    return 0n;
  }
}

function parseDistributionDraft(value: string): DistributionEntry[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [account, amount, vestingFlag] = line.split(/[\s,]+/).filter(Boolean);
      return {
        account: account ?? "",
        amount: amount ?? "",
        vesting: vestingFlag === "vesting",
        vestingStart: "0",
        cliff: "0",
        duration: "0",
        revocable: false,
      } satisfies DistributionEntry;
    })
    .filter((entry) => entry.account.length > 0 && entry.amount.length > 0);
}

export default function FactoryClient() {
  const chainId = useChainId();
  const { address } = useAccount();
  const factoryAddress = useMemo(() => getTokenFactoryForChain(chainId), [chainId]);
  const factoryAddressResolved = factoryAddress ?? "";
  console.log("Factory address from env:", process.env.NEXT_PUBLIC_TOKEN_FACTORY_97);
  const factoryIsValid = factoryAddressResolved ? isAddress(factoryAddressResolved) : false;
  const { data: txHash, writeContractAsync, isPending } = useWriteContract();
  const [lastHash, setLastHash] = useState<string | undefined>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>("tier");
  const [tierId, setTierId] = useState<number>(TIER_DEFINITIONS[0]?.id ?? 1);
  const [initState, setInitState] = useState<WizardTokenInitState>(DEFAULT_INIT_STATE);
  const [configState, setConfigState] = useState<WizardTokenConfigState>(DEFAULT_CONFIG_STATE);
  const [distributionDraft, setDistributionDraft] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [vestingConfig, setVestingConfig] = useState<Record<string, VestingFormState>>({});

  const tierDefinition = useMemo(() => TIER_DEFINITIONS.find((t) => t.id === tierId), [tierId]);
  const isEliteTier = tierDefinition?.name === "Elite";

  useEffect(() => {
    if (!initState.owner && address) {
      setInitState((state) => ({ ...state, owner: address }));
    }
  }, [address, initState.owner]);

  useEffect(() => {
    setConfigState((state) => {
      const nextMinters = isEliteTier ? state.minters : "";
      if (state.mintable === isEliteTier && state.minters === nextMinters) {
        return state;
      }
      return {
        ...state,
        mintable: isEliteTier,
        minters: nextMinters,
      };
    });
  }, [isEliteTier]);

  const requiredValue = tierDefinition?.priceWei ?? 0n;
  const distributionEntries = useMemo(() => parseDistributionDraft(distributionDraft), [distributionDraft]);

  useEffect(() => {
    setVestingConfig((prev) => {
      const next: Record<string, VestingFormState> = {};
      let changed = false;
      distributionEntries.forEach((entry, index) => {
        if (!entry.vesting) return;
        const key = `${entry.account}-${index}`;
        const current = prev[key];
        next[key] = current ?? { start: "", cliffDays: "", durationDays: "", revocable: false };
        if (!current) {
          changed = true;
        }
      });

      if (!changed) {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length !== nextKeys.length) {
          changed = true;
        } else {
          for (const key of nextKeys) {
            if (prev[key] !== next[key]) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [distributionEntries]);

  const vestingEntries = useMemo(
    () =>
      distributionEntries
        .map((entry, index) => ({ entry, index, key: `${entry.account}-${index}` }))
        .filter((item) => item.entry.vesting),
    [distributionEntries],
  );

  const formatAccount = (value: string) =>
    value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

  const vestingValidationError = useMemo(() => {
    for (const { entry, key } of vestingEntries) {
      const config = vestingConfig[key];
      const label = formatAccount(entry.account);
      if (!config) {
        return `Fill vesting details for ${label}.`;
      }
      const parsedStart = config.start ? Date.parse(config.start) : NaN;
      if (!config.start || Number.isNaN(parsedStart)) {
        return `Select a valid start date for ${label}.`;
      }
      const cliff = Number(config.cliffDays || "0");
      const duration = Number(config.durationDays || "0");
      if (!Number.isFinite(cliff) || !Number.isFinite(duration)) {
        return `Cliff and duration must be numeric for ${label}.`;
      }
      if (duration <= 0) {
        return `Duration must be greater than zero for ${label}.`;
      }
      if (duration < cliff) {
        return `Duration must be greater than or equal to the cliff for ${label}.`;
      }
    }
    return undefined;
  }, [vestingEntries, vestingConfig]);

  const canProceedTier = !!tierDefinition;
  const canProceedDetails = Boolean(initState.name && initState.symbol && initState.decimals && factoryIsValid);
  const canProceedConfig = distributionEntries.length > 0 && !vestingValidationError;

  const disableFeature = (feature: FactoryFeature) => !tierAllowsFeature(tierDefinition, feature);

  const summaryRows = [
    { label: "Token name", value: initState.name || "-" },
    { label: "Symbol", value: initState.symbol || "-" },
    { label: "Decimals", value: initState.decimals || "-" },
    { label: "Tier", value: `${tierDefinition?.name ?? "-"} (${formatBNB(requiredValue)} BNB)` },
    { label: "Factory", value: factoryIsValid ? factoryAddressResolved : "Not set" },
    { label: "Initial supply", value: configState.initialSupply },
    { label: "Recipients", value: String(distributionEntries.length) },
    ...(vestingEntries.length > 0
      ? [
          {
            label: "Vesting locks",
            value: `${vestingEntries.length} recipient${vestingEntries.length === 1 ? "" : "s"}`,
          },
        ]
      : []),
  ];

  const handleCreate = async () => {
    try {
      setError(undefined);
      if (!factoryIsValid) throw new Error("TokenFactory address is not configured for this chain");
      const targetFactory = factoryAddressResolved as Address;
      if (!tierDefinition) throw new Error("Tier definition not found");
      if (!address) throw new Error("Connect wallet");

      const decimals = Number(initState.decimals || "18");
      const cap = parseBigInt(configState.cap, decimals);
      const initialSupply = parseBigInt(configState.initialSupply, decimals);
      const autoLiquidityBps = Number(configState.autoLiquidityBps || "0");

      const ownerAddress: Address = (initState.owner && isAddress(initState.owner)
        ? (initState.owner as Address)
        : (address ?? zeroAddress));

      const tokenInit: any = {
        name: initState.name,
        symbol: initState.symbol,
        decimals,
        owner: ownerAddress,
        tierId,
        templateVersion: 0n,
      };

      if (distributionEntries.length === 0) {
        throw new Error("Add at least one distribution recipient");
      }

      const tokenConfig: any = {
        initialSupply,
        cap,
        mintable: tierAllowsFeature(tierDefinition, FactoryFeature.Mint) && configState.mintable,
        burnable: configState.burnable,
        pausable: configState.pausable,
        governanceEnabled: configState.governanceEnabled,
        autoLiquidityEnabled: configState.autoLiquidityEnabled,
        antiWhaleEnabled: configState.antiWhaleEnabled,
        stakingEnabled: configState.stakingEnabled,
        autoLiquidityBps,
        autoLiquidityRouter: configState.autoLiquidityRouter && isAddress(configState.autoLiquidityRouter)
          ? (configState.autoLiquidityRouter as Address)
          : zeroAddress,
        autoLiquidityPairToken: configState.autoLiquidityPairToken && isAddress(configState.autoLiquidityPairToken)
          ? (configState.autoLiquidityPairToken as Address)
          : zeroAddress,
        stakingManager: configState.stakingManager && isAddress(configState.stakingManager)
          ? (configState.stakingManager as Address)
          : zeroAddress,
        metadataURI: configState.metadataURI,
        brandingURI: configState.brandingURI,
        fees: configState.fees.map((fee) => ({
          feeType: Number(fee.feeType),
          bps: Number(fee.bps),
          recipient: fee.recipient as Address,
        })),
        initialDistribution: distributionEntries.map((entry, index) => {
          const decimals = Number(initState.decimals || "18");
          if (!entry.vesting) {
            return {
              account: entry.account as Address,
              amount: parseBigInt(entry.amount, decimals),
              vesting: false,
              vestingStart: 0n,
              cliff: 0n,
              duration: 0n,
              revocable: false,
            };
          }

          const key = `${entry.account}-${index}`;
          const config = vestingConfig[key];
          const parsedStart = config?.start ? Date.parse(config.start) : NaN;
          const startSeconds = Number.isNaN(parsedStart) ? 0 : Math.floor(parsedStart / 1000);
          const cliffDays = Number(config?.cliffDays || "0");
          const durationDays = Number(config?.durationDays || "0");

          return {
            account: entry.account as Address,
            amount: parseBigInt(entry.amount, decimals),
            vesting: true,
            vestingStart: BigInt(startSeconds),
            cliff: BigInt(Number.isFinite(cliffDays) ? Math.max(0, Math.round(cliffDays * 86_400)) : 0),
            duration: BigInt(Number.isFinite(durationDays) ? Math.max(0, Math.round(durationDays * 86_400)) : 0),
            revocable: config?.revocable ?? false,
          };
        }),
        minters: parseAddresses(configState.minters),
        pausers: parseAddresses(configState.pausers),
        burners: parseAddresses(configState.burners),
        bridgeOperators: parseAddresses(configState.bridgeOperators),
        antiWhale: {
          enabled: configState.antiWhale.enabled,
          maxTxAmount: parseBigInt(configState.antiWhale.maxTxAmount, decimals),
          maxWalletAmount: parseBigInt(configState.antiWhale.maxWalletAmount, decimals),
          cooldownBlocks: BigInt(Number(configState.antiWhale.cooldownBlocks || "0")),
        },
      };

      const hash = await writeContractAsync({
        abi: TokenFactoryABI,
        address: targetFactory,
        functionName: "createToken",
        args: [tierId, tokenInit, tokenConfig] as any,
        value: requiredValue,
      });

      addToast({
        kind: "success",
        title: "Transaction submitted",
        message: hash,
        linkHref: chainId === 97 ? `https://testnet.bscscan.com/tx/${hash}` : undefined,
      });
      setLastHash(hash);
      setStep("review");
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Failed to send transaction";
      setError(message);
      addToast({ kind: "error", title: "Token creation failed", message });
    }
  };

  return (
    <div className="mt-8 grid gap-6 rounded-lg border border-neutral-light/10 bg-white/5 p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-neutral-light">Token Factory wizard</h2>
        <p className="text-sm text-neutral-light/70">Deploy an ERC20 from tiered templates with advanced features.</p>
      </header>

      <nav className="flex gap-2 text-xs text-neutral-light/60">
        {(["tier", "details", "config", "review"] as Step[]).map((s) => (
          <span
            key={s}
            className={`rounded px-2 py-1 ${step === s ? "bg-primary/20 text-primary" : "bg-white/5"}`}
          >
            {s.toUpperCase()}
          </span>
        ))}
      </nav>

      {step === "tier" && (
        <section className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-xs text-neutral-light/70">Select tier</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIER_DEFINITIONS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setTierId(tier.id)}
                  className={`rounded border px-3 py-3 text-left transition ${
                    tierId === tier.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5 hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-semibold text-neutral-light">{tier.name}</div>
                  <div className="text-xs text-neutral-light/70">{tier.blurb}</div>
                  <div className="mt-2 text-xs text-neutral-light/80">Cost: {formatBNB(tier.priceWei)} BNB</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-neutral-light/80">
            <div className="font-semibold text-neutral-light">Features</div>
            <ul className="mt-2 space-y-1">
              {Object.values(FactoryFeature).map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      tierAllowsFeature(tierDefinition, feature) ? "bg-green-400" : "bg-red-500/60"
                    }`}
                  />
                  <span>{FEATURE_DESCRIPTIONS[feature]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep("details")}
              disabled={!canProceedTier}
              className="rounded bg-primary px-4 py-2 text-sm text-neutral-dark disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "details" && (
        <section className="grid gap-4">
          <label className="grid gap-2 text-sm text-neutral-light/90">
            <span>Name</span>
            <input
              value={initState.name}
              onChange={(e) => setInitState((state) => ({ ...state, name: e.target.value }))}
              placeholder="Awesome Token"
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-neutral-light/90">
            <span>Symbol</span>
            <input
              value={initState.symbol}
              onChange={(e) => setInitState((state) => ({ ...state, symbol: e.target.value.toUpperCase() }))}
              placeholder="ATK"
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-neutral-light/90">
            <span>Decimals</span>
            <input
              value={initState.decimals}
              onChange={(e) => setInitState((state) => ({ ...state, decimals: e.target.value }))}
              inputMode="numeric"
              className="w-24 rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm text-neutral-light/90">
            <span>Owner address (optional)</span>
            <input
              value={initState.owner}
              onChange={(e) => setInitState((state) => ({ ...state, owner: e.target.value }))}
              placeholder={address || "0x..."}
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
            />
          </label>

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep("tier") } className="rounded bg-white/10 px-4 py-2 text-sm text-neutral-light">
              Back
            </button>
            <button
              onClick={() => setStep("config")}
              disabled={!canProceedDetails}
              className="rounded bg-primary px-4 py-2 text-sm text-neutral-dark disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "config" && (
        <section className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Initial supply</label>
            <input
              value={configState.initialSupply}
              onChange={(e) => setConfigState((state) => ({ ...state, initialSupply: e.target.value }))}
              placeholder="1000000"
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Initial distribution (one entry per line)</label>
            <textarea
              rows={4}
              value={distributionDraft}
              onChange={(e) => {
                setDistributionDraft(e.target.value);
              }}
              placeholder={`0xabc... 100000\n0xdef... 250000 vesting`}
              className={`rounded bg-neutral-dark/40 px-3 py-2 text-xs text-neutral-light outline-none ${
                distributionDraft && distributionEntries.length === 0 ? "ring-1 ring-red-500/60" : ""
              }`}
            />
            <span className="text-xs text-neutral-light/50">Format: `address amount [vesting]`. Each line must include a valid address and amount.</span>
            {distributionDraft && distributionEntries.length === 0 && (
              <span className="text-xs text-red-300">Make sure every line has a valid address and amount.</span>
            )}
          </div>

          <button
            onClick={() => {
              const ownerAddress = initState.owner || address;
              if (!ownerAddress) return;
              const current = distributionDraft.trim();
              const nextLine = `${ownerAddress} ${configState.initialSupply || "0"}`;
              const updated = current ? `${current}\n${nextLine}` : nextLine;
              setDistributionDraft(updated);
            }}
            className="w-fit rounded bg-white/10 px-2 py-1 text-xs text-neutral-light"
          >
            Autofill owner distribution
          </button>

          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Metadata URI</label>
            <input
              value={configState.metadataURI}
              onChange={(e) => setConfigState((state) => ({ ...state, metadataURI: e.target.value }))}
              disabled={disableFeature(FactoryFeature.Metadata)}
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none disabled:opacity-40"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Branding URI</label>
            <input
              value={configState.brandingURI}
              onChange={(e) => setConfigState((state) => ({ ...state, brandingURI: e.target.value }))}
              disabled={disableFeature(FactoryFeature.Branding)}
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none disabled:opacity-40"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Auto-liquidity BPS</label>
            <input
              value={configState.autoLiquidityBps}
              onChange={(e) => setConfigState((state) => ({ ...state, autoLiquidityBps: e.target.value }))}
              disabled={disableFeature(FactoryFeature.AutoLiquidity)}
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none disabled:opacity-40"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-neutral-light/90">Minters (Elite tier only)</label>
            <input
              value={configState.minters}
              onChange={(e) => setConfigState((state) => ({ ...state, minters: e.target.value }))}
              disabled={!isEliteTier || disableFeature(FactoryFeature.Roles)}
              placeholder={isEliteTier ? "0xabc...,0xdef..." : "Available on Elite tier"}
              className="rounded bg-neutral-dark/40 px-3 py-2 text-sm text-neutral-light outline-none disabled:opacity-40"
            />
          </div>

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep("details") } className="rounded bg-white/10 px-4 py-2 text-sm text-neutral-light">
              Back
            </button>
            <button
              onClick={() => {
                if (distributionEntries.length === 0) {
                  setError("Add at least one recipient with address and amount.");
                  return;
                }
                const invalidAddress = distributionEntries.find((entry) => !isAddress(entry.account));
                if (invalidAddress) {
                  setError(`The address ${invalidAddress.account} is not valid.`);
                  return;
                }
                const total = distributionEntries.reduce((acc, entry) => acc + parseFloat(entry.amount || "0"), 0);
                const supply = parseFloat(configState.initialSupply || "0");
                if (!Number.isFinite(total) || total <= 0) {
                  setError("Amounts must be numbers greater than zero.");
                  return;
                }
                if (Number.isFinite(supply) && supply > 0 && Math.abs(total - supply) > 1e-9) {
                  setError("Distribution totals must match the initial supply.");
                  return;
                }
                if (vestingValidationError) {
                  setError(vestingValidationError);
                  return;
                }
                setError(undefined);
                setStep("review");
              }}
              disabled={!canProceedConfig}
              className="rounded bg-primary px-4 py-2 text-sm text-neutral-dark disabled:opacity-40"
            >
              Continue
            </button>
            {vestingValidationError && (
              <span className="text-xs text-red-300">{vestingValidationError}</span>
            )}
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="grid gap-4">
          <div className="rounded border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-neutral-light">Overview</h3>
            <dl className="mt-3 grid gap-2 text-xs text-neutral-light/80">
              {summaryRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt className="font-medium text-neutral-light/60">{row.label}</dt>
                  <dd className="text-right text-neutral-light">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {!!error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">{error}</div>}

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep("config") } className="rounded bg-white/10 px-4 py-2 text-sm text-neutral-light">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={isPending || isConfirming}
              className="rounded bg-primary px-4 py-2 text-sm text-neutral-dark disabled:opacity-40"
            >
              {isPending || isConfirming ? "Submitting…" : `Create token (${formatBNB(requiredValue)} BNB)`}
            </button>
          </div>

          {lastHash && <div className="text-xs text-neutral-light/70">Tx: {lastHash}</div>}
          {isSuccess && <div className="text-xs text-primary">Transaction confirmed.</div>}
        </section>
      )}
    </div>
  );
}
