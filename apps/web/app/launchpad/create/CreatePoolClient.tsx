'use client';

import { useEffect, useMemo, useState } from 'react';
import { Address, parseUnits } from 'viem';
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { IDOFactoryABI } from '../../../lib/abi/IDOFactory';
import { getIdoFactoryForChain } from '../../../lib/config';
import { useRouter } from 'next/navigation';
import { ERC20ABI } from '../../../lib/abi/ERC20';
import { useToast } from '../../../components/ui/Toast';

export default function CreatePoolClient() {
  const router = useRouter();
  const chainIdRaw = useChainId();
  const chainId = chainIdRaw || 97;
  const factoryPrimary = useMemo(() => getIdoFactoryForChain(chainId), [chainId]);
  const effectiveChainId = factoryPrimary ? chainId : 97;
  const factory = useMemo(() => factoryPrimary || getIdoFactoryForChain(97), [factoryPrimary]);
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: effectiveChainId } as any);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { addToast } = useToast();

  const [form, setForm] = useState({
    saleToken: '',
    raiseToken: '',
    fundsRecipient: '',
    startTimeLocal: '', // datetime-local string
    endTimeLocal: '',
    softCapHuman: '', // in raise token units
    hardCapHuman: '',
    minContributionHuman: '',
    maxContributionHuman: '',
    tokensPerUnit: '', // integer
    whitelistEnabled: false,
  });
  const [error, setError] = useState<string | undefined>();
  const [raiseDecimals, setRaiseDecimals] = useState<number>(18);
  const [saleDecimals, setSaleDecimals] = useState<number>(18);
  const [valid, setValid] = useState<boolean>(false);
  const [raisePreset, setRaisePreset] = useState<string>('');

  // Common BSC Testnet tokens
  const presets97 = [
    { label: 'WBNB (testnet)', address: '0xae13d989dac2f0debff460ac112a837c89baa7cd' },
    { label: 'USDT (testnet)', address: '0x7ef95a0FeBf6a1A8B7f49C88aD36b47fF6bC8Bd0' },
    { label: 'USDC (testnet)', address: '0x64544969ed7EBf5f083679233325356EbE738930' },
    { label: 'Custom…', address: '' },
  ];

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === 'checkbox' ? checked : value }));
  }

  function onSelectRaisePreset(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setRaisePreset(v);
    // If preset chosen and not Custom, set raiseToken; if Custom, keep current and let user type
    if (v && v !== 'custom') {
      setForm((s) => ({ ...s, raiseToken: v }));
    }
  }

  // Auto-detect decimals for ERC20 inputs (sale/raise). Defaults to 18 if fetch fails.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (publicClient && form.raiseToken && /^0x[a-fA-F0-9]{40}$/.test(form.raiseToken)) {
          const dec = (await publicClient.readContract({
            abi: ERC20ABI as any,
            address: form.raiseToken as Address,
            functionName: 'decimals',
            args: [],
          })) as number;
          if (mounted) setRaiseDecimals(dec || 18);
        } else {
          if (mounted) setRaiseDecimals(18);
        }
      } catch {
        if (mounted) setRaiseDecimals(18);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient, form.raiseToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (publicClient && form.saleToken && /^0x[a-fA-F0-9]{40}$/.test(form.saleToken)) {
          const dec = (await publicClient.readContract({
            abi: ERC20ABI as any,
            address: form.saleToken as Address,
            functionName: 'decimals',
            args: [],
          })) as number;
          if (mounted) setSaleDecimals(dec || 18);
        } else {
          if (mounted) setSaleDecimals(18);
        }
      } catch {
        if (mounted) setSaleDecimals(18);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient, form.saleToken]);

  // Basic validation
  useEffect(() => {
    const ok =
      /^0x[a-fA-F0-9]{40}$/.test(form.saleToken) &&
      /^0x[a-fA-F0-9]{40}$/.test(form.raiseToken) &&
      (!!form.startTimeLocal && !!form.endTimeLocal) &&
      !!form.tokensPerUnit;
    setValid(ok);
  }, [form]);

  async function onCreate() {
    try {
      setError(undefined);
      if (!address) throw new Error('Connect your wallet');
      if (!factory) throw new Error(`IDOFactory address missing for chain ${effectiveChainId}`);
      if (chainIdRaw && chainIdRaw !== effectiveChainId) throw new Error(`Switch your wallet to chain ${effectiveChainId} to create the pool`);
      // Convert datetime-local strings to unix seconds
      const toTs = (v: string) => BigInt(Math.floor(new Date(v).getTime() / 1000));
      // Convert human amounts in raise token units to wei using raiseDecimals
      const toAmount = (v: string) => (v ? parseUnits(v as `${number}` as string, raiseDecimals) : 0n);
      const toInt = (v: string) => BigInt(v || '0');

      writeContract({
        abi: IDOFactoryABI as any,
        address: factory as Address,
        functionName: 'createPool',
        args: [
          address as Address,
          form.saleToken as Address,
          form.raiseToken as Address,
          (form.fundsRecipient || address) as Address,
          toTs(form.startTimeLocal),
          toTs(form.endTimeLocal),
          toAmount(form.softCapHuman),
          toAmount(form.hardCapHuman),
          toAmount(form.minContributionHuman),
          toAmount(form.maxContributionHuman),
          toInt(form.tokensPerUnit),
          form.whitelistEnabled,
        ],
      });
      // Sent toast will be handled when txHash becomes available
    } catch (e: any) {
      setError(e?.message || 'Failed to create pool');
      addToast({ kind: 'error', title: 'Create failed', message: e?.message || 'Failed to create pool' });
    }
  }

  // Toast when tx sent
  useEffect(() => {
    if (txHash) {
      const base = effectiveChainId === 97 ? 'https://testnet.bscscan.com' : effectiveChainId === 56 ? 'https://bscscan.com' : '';
      addToast({
        kind: 'info',
        title: 'Transaction sent',
        message: 'Create pool transaction submitted.',
        linkHref: base ? `${base}/tx/${txHash}` : undefined,
        linkLabel: 'View on Explorer',
      });
    }
  }, [txHash, effectiveChainId, addToast]);

  // Toast when confirmed
  useEffect(() => {
    if (isSuccess && txHash) {
      const base = effectiveChainId === 97 ? 'https://testnet.bscscan.com' : effectiveChainId === 56 ? 'https://bscscan.com' : '';
      addToast({
        kind: 'success',
        title: 'Pool created',
        message: 'Your pool was created successfully.',
        linkHref: base ? `${base}/tx/${txHash}` : undefined,
        linkLabel: 'View on Explorer',
      });
    }
  }, [isSuccess, txHash, effectiveChainId, addToast]);

  if (!factory) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-accent">
        IDOFactory address missing for this chain. Using BSC Testnet (97) is recommended. Set NEXT_PUBLIC_IDO_FACTORY_{chainId} in .env.local or switch to chain 97.
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-neutral-light/80">
        Connect your wallet to create a pool.
      </div>
    );
  }

  if (chainIdRaw && chainIdRaw !== effectiveChainId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-yellow-200">
        Please switch your wallet network to BSC Testnet (97) to create pools here.
      </div>
    );
  }

  if (isSuccess) {
    // After confirm, go back to list
    router.push('/launchpad');
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-light">Create Pool</h1>
      <div className="grid gap-3">
        {error && <div className="rounded bg-accent/10 p-3 text-accent">{error}</div>}
        <input name="saleToken" value={form.saleToken} onChange={onChange} placeholder="Sale token address (ERC20)" className="rounded bg-white/5 p-2 text-neutral-light" />
        <div className="text-[10px] text-neutral-light/60">Token to be distributed to contributors.</div>
        <label className="text-neutral-light/80 text-sm">Raise token</label>
        <select value={raisePreset} onChange={onSelectRaisePreset} className="rounded bg-white/5 p-2 text-neutral-light">
          <option value="">Select a token</option>
          {presets97.map((p) => (
            <option key={p.label} value={p.address || 'custom'}>{p.label}</option>
          ))}
        </select>
        {(raisePreset === 'custom' || !raisePreset) && (
          <input name="raiseToken" value={form.raiseToken} onChange={onChange} placeholder="Raise token address (e.g., WBNB)" className="rounded bg-white/5 p-2 text-neutral-light" />
        )}
        <div className="text-xs text-neutral-light/60">Detected raise token decimals: {raiseDecimals}</div>
        <div className="text-[10px] text-neutral-light/60">Asset accepted for contributions.</div>
        <input name="fundsRecipient" value={form.fundsRecipient} onChange={onChange} placeholder="Funds recipient (optional, defaults to your address)" className="rounded bg-white/5 p-2 text-neutral-light" />
        <div className="text-[10px] text-neutral-light/60">Address that receives raised funds after a successful finalize.</div>
        <label className="text-neutral-light/80 text-sm">Start time</label>
        <input type="datetime-local" name="startTimeLocal" value={form.startTimeLocal} onChange={onChange} className="rounded bg-white/5 p-2 text-neutral-light" />
        <div className="text-[10px] text-neutral-light/60">Contributions are allowed only between Start and End.</div>
        <label className="text-neutral-light/80 text-sm">End time</label>
        <input type="datetime-local" name="endTimeLocal" value={form.endTimeLocal} onChange={onChange} className="rounded bg-white/5 p-2 text-neutral-light" />
        <div className="grid grid-cols-2 gap-3">
          <input name="softCapHuman" value={form.softCapHuman} onChange={onChange} placeholder="Soft cap (in raise token units)" className="rounded bg-white/5 p-2 text-neutral-light" />
          <input name="hardCapHuman" value={form.hardCapHuman} onChange={onChange} placeholder="Hard cap (in raise token units)" className="rounded bg-white/5 p-2 text-neutral-light" />
          <input name="minContributionHuman" value={form.minContributionHuman} onChange={onChange} placeholder="Min contribution (in raise token units)" className="rounded bg-white/5 p-2 text-neutral-light" />
          <input name="maxContributionHuman" value={form.maxContributionHuman} onChange={onChange} placeholder="Max contribution (in raise token units)" className="rounded bg-white/5 p-2 text-neutral-light" />
        </div>
        <div className="text-[10px] text-neutral-light/60">Soft cap: mínimo para éxito. Hard cap: máximo recaudado. Min/Max: límites por wallet.</div>
        <input name="tokensPerUnit" value={form.tokensPerUnit} onChange={onChange} placeholder="Tokens received per 1 raise token (integer)" className="rounded bg-white/5 p-2 text-neutral-light" />
        <div className="text-[10px] text-neutral-light/60">Ej.: si es 1000, por cada 1 {raisePreset ? 'raise' : ''} recibes 1000 del sale token.</div>
        <label className="flex items-center gap-2 text-neutral-light">
          <input type="checkbox" name="whitelistEnabled" checked={form.whitelistEnabled} onChange={onChange} />
          Enable whitelist
        </label>
        <div className="text-[10px] text-neutral-light/60">Si está activo, solo addresses en whitelist pueden contribuir.</div>
        <button disabled={!valid || isPending || isConfirming} className="rounded bg-primary px-4 py-2 text-neutral-dark disabled:opacity-50" onClick={onCreate}>
          {isPending || isConfirming ? 'Creating…' : 'Create Pool'}
        </button>
      </div>
    </div>
  );
}
