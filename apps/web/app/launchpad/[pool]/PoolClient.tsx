'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Address, formatUnits, parseUnits, zeroAddress } from 'viem';
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { IDOPoolABI } from '../../../lib/abi/IDOPool';
import { ERC20ABI } from '../../../lib/abi/ERC20';
import { useToast } from '../../../components/ui/Toast';

function fmtTs(ts?: bigint) {
  if (!ts) return '-';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString();
}

export default function PoolClient({ params }: { params: { pool: string } }) {
  const pool = params.pool as Address;
  const chainId = useChainId() || 97;
  const publicClient = usePublicClient({ chainId } as any);
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [saleToken, setSaleToken] = useState<Address | undefined>();
  const [raiseToken, setRaiseToken] = useState<Address | undefined>();
  const [fundsRecipient, setFundsRecipient] = useState<Address | undefined>();
  const [startTime, setStartTime] = useState<bigint | undefined>();
  const [endTime, setEndTime] = useState<bigint | undefined>();
  const [softCap, setSoftCap] = useState<bigint | undefined>();
  const [hardCap, setHardCap] = useState<bigint | undefined>();
  const [minContribution, setMinContribution] = useState<bigint | undefined>();
  const [maxContribution, setMaxContribution] = useState<bigint | undefined>();
  const [tokensPerUnit, setTokensPerUnit] = useState<bigint | undefined>();
  const [status, setStatus] = useState<number | undefined>();
  const [totalRaised, setTotalRaised] = useState<bigint | undefined>();
  const [whitelistEnabled, setWhitelistEnabled] = useState<boolean>(false);
  const [owner, setOwner] = useState<Address | undefined>();
  const [myContribution, setMyContribution] = useState<bigint>(0n);
  const [myClaimed, setMyClaimed] = useState<boolean>(false);

  const [raiseDecimals, setRaiseDecimals] = useState<number>(18);
  const [saleDecimals, setSaleDecimals] = useState<number>(18);
  const [amountHuman, setAmountHuman] = useState('');
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [saleSymbol, setSaleSymbol] = useState<string>('SALE');
  const [raiseSymbol, setRaiseSymbol] = useState<string>('RAISE');
  const [wlInput, setWlInput] = useState('');
  const [wlBatch, setWlBatch] = useState('');
  const [depositAmt, setDepositAmt] = useState('');

  // Load core data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(undefined);
        if (!publicClient) throw new Error('No public RPC client');
        const [sale, raise, funds, st, et, soft, hard, minC, maxC, tpu, stat, raised, wl] = await Promise.all([
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'saleToken' }) as Promise<Address>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'raiseToken' }) as Promise<Address>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'fundsRecipient' }) as Promise<Address>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'startTime' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'endTime' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'softCap' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'hardCap' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'minContribution' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'maxContribution' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'tokensPerUnit' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'status' }) as Promise<number>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'totalRaised' }) as Promise<bigint>,
          publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'whitelistEnabled' }) as Promise<boolean>,
        ]);
        if (!mounted) return;
        setSaleToken(sale);
        setRaiseToken(raise);
        setFundsRecipient(funds);
        setStartTime(st);
        setEndTime(et);
        setSoftCap(soft);
        setHardCap(hard);
        setMinContribution(minC);
        setMaxContribution(maxC);
        setTokensPerUnit(tpu);
        setStatus(stat);
        setTotalRaised(raised);
        setWhitelistEnabled(wl);
        // owner
        const own = (await publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'owner' })) as Address;
        setOwner(own);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load pool');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient, pool]);

  // Load decimals and allowance
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!publicClient) return;
        if (raiseToken && raiseToken !== zeroAddress) {
          const dec = (await publicClient.readContract({ abi: ERC20ABI as any, address: raiseToken, functionName: 'decimals' })) as number;
          if (mounted) setRaiseDecimals(dec || 18);
          if (address) {
            const allw = (await publicClient.readContract({ abi: ERC20ABI as any, address: raiseToken, functionName: 'allowance', args: [address as Address, pool] })) as bigint;
            if (mounted) setAllowance(allw);
          }
        } else {
          if (mounted) setRaiseDecimals(18);
        }
        if (saleToken) {
          const sdec = (await publicClient.readContract({ abi: ERC20ABI as any, address: saleToken, functionName: 'decimals' })) as number;
          if (mounted) setSaleDecimals(sdec || 18);
          try {
            const ssym = (await publicClient.readContract({ abi: ERC20ABI as any, address: saleToken, functionName: 'symbol' })) as string;
            if (mounted && ssym) setSaleSymbol(ssym);
          } catch {}
        }
        // symbols for raise token
        if (raiseToken && raiseToken !== zeroAddress) {
          try {
            const rsym = (await publicClient.readContract({ abi: ERC20ABI as any, address: raiseToken, functionName: 'symbol' })) as string;
            if (mounted && rsym) setRaiseSymbol(rsym);
          } catch {}
        } else {
          if (mounted) setRaiseSymbol('BNB');
        }
        // my stats
        if (address) {
          const contrib = (await publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'contributions', args: [address as Address] })) as bigint;
          const claimed = (await publicClient.readContract({ abi: IDOPoolABI as any, address: pool, functionName: 'claimed', args: [address as Address] })) as boolean;
          if (mounted) {
            setMyContribution(contrib);
            setMyClaimed(claimed);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [publicClient, raiseToken, saleToken, address, pool]);

  const statusText = useMemo(() => {
    switch (status) {
      case 0: return 'Pending';
      case 1: return 'Active';
      case 2: return 'Finalized (Success)';
      case 3: return 'Finalized (Fail)';
      default: return '-';
    }
  }, [status]);

  const now = Date.now() / 1000;
  const timeActive = startTime && endTime ? (Number(startTime) <= now && now < Number(endTime)) : false;
  const isActive = (status === 0 || status === 1) && timeActive;
  const isAfter = status === 2 || status === 3 || (endTime ? Number(endTime) <= now : false);
  const isOwner = owner && address ? owner.toLowerCase() === address.toLowerCase() : false;
  const canContribute = isActive;
  const canClaim = status === 2 && myContribution > 0n && !myClaimed;
  const canRefund = status === 3 && myContribution > 0n;
  const progress = hardCap && totalRaised ? Number(totalRaised) / Number(hardCap) : 0;
  const explorerBase = chainId === 97 ? 'https://testnet.bscscan.com' : chainId === 56 ? 'https://bscscan.com' : '';

  async function onApprove() {
    try {
      setError(undefined);
      if (!address || !raiseToken || raiseToken === zeroAddress) return;
      // Approve unlimited for simplicity
      await writeContract({ abi: ERC20ABI as any, address: raiseToken, functionName: 'approve', args: [pool, 2n ** 256n - 1n] });
    } catch (e: any) {
      setError(e?.message || 'Approve failed');
      addToast({ kind: 'error', title: 'Approve failed', message: e?.message || 'Approve failed' });
    }
  }

  async function onContribute() {
    try {
      setError(undefined);
      if (!publicClient || !raiseToken) throw new Error('Missing chain context');
      const amt = amountHuman ? parseUnits(amountHuman as `${number}` as string, raiseDecimals) : 0n;
      if (amt <= 0n) throw new Error('Enter a valid amount');
      if (raiseToken === zeroAddress) {
        await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'contribute', args: [0n], value: amt });
      } else {
        if (allowance < amt) throw new Error('Please approve first');
        await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'contribute', args: [amt] });
      }
    } catch (e: any) {
      setError(e?.message || 'Contribute failed');
      addToast({ kind: 'error', title: 'Contribute failed', message: e?.message || 'Contribute failed' });
    }
  }

  async function onClaim() {
    try {
      setError(undefined);
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'claim', args: [] });
    } catch (e: any) {
      setError(e?.message || 'Claim failed');
      addToast({ kind: 'error', title: 'Claim failed', message: e?.message || 'Claim failed' });
    }
  }

  async function onRefund() {
    try {
      setError(undefined);
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'refund', args: [] });
    } catch (e: any) {
      setError(e?.message || 'Refund failed');
      addToast({ kind: 'error', title: 'Refund failed', message: e?.message || 'Refund failed' });
    }
  }

  async function onFinalize() {
    try {
      setError(undefined);
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'finalize', args: [] });
    } catch (e: any) {
      setError(e?.message || 'Finalize failed');
      addToast({ kind: 'error', title: 'Finalize failed', message: e?.message || 'Finalize failed' });
    }
  }

  async function onWhitelistSingle(allowed: boolean) {
    try {
      setError(undefined);
      if (!wlInput || !/^0x[a-fA-F0-9]{40}$/.test(wlInput)) throw new Error('Enter a valid address');
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'setWhitelist', args: [wlInput as Address, allowed] });
    } catch (e: any) {
      setError(e?.message || 'Whitelist update failed');
      addToast({ kind: 'error', title: 'Whitelist failed', message: e?.message || 'Whitelist update failed' });
    }
  }

  async function onWhitelistBatch(allowed: boolean) {
    try {
      setError(undefined);
      const addrs = wlBatch
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => s)
        .map((s) => s as Address);
      if (addrs.length === 0) throw new Error('Paste one or more addresses');
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'setWhitelistBatch', args: [addrs, allowed] });
    } catch (e: any) {
      setError(e?.message || 'Whitelist batch failed');
      addToast({ kind: 'error', title: 'Whitelist batch failed', message: e?.message || 'Whitelist batch failed' });
    }
  }

  async function onDepositSale() {
    try {
      setError(undefined);
      if (!depositAmt) throw new Error('Enter amount');
      if (!saleToken) throw new Error('Sale token unknown');
      const amt = parseUnits(depositAmt as `${number}` as string, saleDecimals);
      // Requires prior ERC20 approval from owner to pool
      await writeContract({ abi: IDOPoolABI as any, address: pool, functionName: 'depositSaleTokens', args: [amt] });
    } catch (e: any) {
      setError(e?.message || 'Deposit failed');
      addToast({ kind: 'error', title: 'Deposit failed', message: e?.message || 'Deposit failed' });
    }
  }

  // Sent toast for any txHash
  useEffect(() => {
    if (txHash) {
      const base = (chainId || 97) === 97 ? 'https://testnet.bscscan.com' : (chainId || 97) === 56 ? 'https://bscscan.com' : '';
      addToast({ kind: 'info', title: 'Transaction sent', message: 'Transaction submitted.', linkHref: base ? `${base}/tx/${txHash}` : undefined, linkLabel: 'View on Explorer' });
    }
  }, [txHash, chainId, addToast]);

  // Confirmed toast
  useEffect(() => {
    if (isSuccess && txHash) {
      const base = (chainId || 97) === 97 ? 'https://testnet.bscscan.com' : (chainId || 97) === 56 ? 'https://bscscan.com' : '';
      addToast({ kind: 'success', title: 'Transaction confirmed', message: 'Your transaction was confirmed.', linkHref: base ? `${base}/tx/${txHash}` : undefined, linkLabel: 'View on Explorer' });
    }
  }, [isSuccess, txHash, chainId, addToast]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-light">Launchpad Pool</h1>
        <Link href="/launchpad" className="text-sm text-primary underline">Back</Link>
      </div>
      {loading && (
        <div className="grid gap-3">
          <div className="animate-pulse rounded-lg border border-neutral-light/10 bg-white/5 p-4">
            <div className="mb-2 h-4 w-60 rounded bg-white/10" />
            <div className="mb-2 h-3 w-40 rounded bg-white/10" />
            <div className="h-2 w-full rounded bg-white/10" />
          </div>
          <div className="animate-pulse rounded-lg border border-neutral-light/10 bg-white/5 p-4">
            <div className="mb-2 h-4 w-52 rounded bg-white/10" />
            <div className="h-24 w-full rounded bg-white/10" />
          </div>
        </div>
      )}
      {error && <div className="mb-3 rounded bg-accent/10 p-3 text-accent">{error}</div>}
      <div className="grid gap-3 rounded-lg border border-neutral-light/10 bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-3 text-neutral-light/90">
          <div className="col-span-2">
            <div className="text-xs text-neutral-light/60">Pool Address</div>
            <div className="truncate">
              {explorerBase ? (
                <a className="underline" href={`${explorerBase}/address/${pool}`} target="_blank" rel="noreferrer">{pool}</a>
              ) : (
                pool
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Sale Token</div>
            <div className="truncate">
              {saleToken && explorerBase ? (
                <a className="underline" href={`${explorerBase}/address/${saleToken}`} target="_blank" rel="noreferrer">{saleToken}</a>
              ) : (
                saleToken || '-'
              )}
            </div>
            <div className="text-xs text-neutral-light/50">Symbol: {saleSymbol}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Raise Token</div>
            <div className="truncate">
              {raiseToken === zeroAddress ? (
                'BNB (native)'
              ) : (
                explorerBase ? (
                  <a className="underline" href={`${explorerBase}/address/${raiseToken}`} target="_blank" rel="noreferrer">{raiseToken}</a>
                ) : (
                  raiseToken
                )
              )}
            </div>
            <div className="text-xs text-neutral-light/50">Symbol: {raiseSymbol}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Start</div>
            <div>{fmtTs(startTime)}</div>
            <div className="text-[10px] text-neutral-light/50">Contributions only allowed between Start and End.</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">End</div>
            <div>{fmtTs(endTime)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Soft/Hard Cap</div>
            <div>{softCap && hardCap ? `${formatUnits(softCap, raiseDecimals)} / ${formatUnits(hardCap, raiseDecimals)}` : '-'}</div>
            <div className="text-[10px] text-neutral-light/50">Soft cap must be reached for success.</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Min/Max</div>
            <div>{minContribution && maxContribution ? `${formatUnits(minContribution, raiseDecimals)} / ${formatUnits(maxContribution, raiseDecimals)}` : '-'}</div>
            <div className="text-[10px] text-neutral-light/50">Per-wallet limits.</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Total Raised</div>
            <div>{totalRaised ? formatUnits(totalRaised, raiseDecimals) : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Status</div>
            <div>{statusText}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-light/60">Funds Recipient</div>
            <div className="truncate">
              {fundsRecipient && explorerBase ? (
                <a className="underline" href={`${explorerBase}/address/${fundsRecipient}`} target="_blank" rel="noreferrer">{fundsRecipient}</a>
              ) : (
                fundsRecipient || '-'
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs text-neutral-light/60">Progress</div>
          <div className="h-2 w-full rounded bg-white/10">
            <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%` }} />
          </div>
        </div>
        {address && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-neutral-light/90">
            <div>
              <div className="text-xs text-neutral-light/60">Your Contribution</div>
              <div>{formatUnits(myContribution, raiseDecimals)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-light/60">Claimed</div>
              <div>{myClaimed ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
        <div className="mt-2 text-xs text-neutral-light/60">Whitelist: {whitelistEnabled ? 'Enabled' : 'Disabled'}</div>
      </div>

      {/* Actions */}
      <div className="mt-6 grid gap-3 rounded-lg border border-neutral-light/10 bg-white/5 p-4">
        <div className="text-neutral-light font-medium">Participate</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={amountHuman} onChange={(e) => setAmountHuman(e.target.value)} placeholder="Amount to contribute" className="rounded bg-white/5 p-2 text-neutral-light" />
          {raiseToken && raiseToken !== zeroAddress && (
            <button disabled={!canContribute} onClick={onApprove} className="rounded bg-white/10 px-4 py-2 text-neutral-light hover:bg-white/20 disabled:opacity-50">Approve</button>
          )}
          <button disabled={!canContribute || isPending || isConfirming} onClick={onContribute} className="rounded bg-primary px-4 py-2 text-neutral-dark disabled:opacity-50">{isPending || isConfirming ? 'Submitting…' : 'Contribute'}</button>
        </div>
        <div className="flex gap-3">
          <button disabled={!canClaim} onClick={onClaim} className="rounded bg-white/10 px-4 py-2 text-neutral-light hover:bg-white/20 disabled:opacity-50">Claim</button>
          <button disabled={!canRefund} onClick={onRefund} className="rounded bg-white/10 px-4 py-2 text-neutral-light hover:bg-white/20 disabled:opacity-50">Refund</button>
          {isOwner && <button disabled={isAfter && status !== 0 && status !== 1 ? false : !isAfter} onClick={onFinalize} className="rounded bg-white/10 px-4 py-2 text-neutral-light hover:bg-white/20 disabled:opacity-50">Finalize</button>}
        </div>
      </div>

      {isOwner && (
        <div className="mt-6 grid gap-4 rounded-lg border border-neutral-light/10 bg-white/5 p-4">
          <div className="text-neutral-light font-medium">Owner Tools</div>
          <div className="grid gap-2">
            <div className="text-sm text-neutral-light/80">Whitelist (single)</div>
            <div className="flex gap-2">
              <input value={wlInput} onChange={(e) => setWlInput(e.target.value)} placeholder="0x... address" className="flex-1 rounded bg-white/5 p-2 text-neutral-light" />
              <button onClick={() => onWhitelistSingle(true)} className="rounded bg-white/10 px-3 py-2 text-neutral-light hover:bg-white/20">Allow</button>
              <button onClick={() => onWhitelistSingle(false)} className="rounded bg-white/10 px-3 py-2 text-neutral-light hover:bg-white/20">Remove</button>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="text-sm text-neutral-light/80">Whitelist (batch)</div>
            <textarea value={wlBatch} onChange={(e) => setWlBatch(e.target.value)} placeholder="One or more 0x... addresses separated by spaces, commas or new lines" className="h-24 w-full rounded bg-white/5 p-2 text-neutral-light" />
            <div className="flex gap-2">
              <button onClick={() => onWhitelistBatch(true)} className="rounded bg-white/10 px-3 py-2 text-neutral-light hover:bg-white/20">Allow Batch</button>
              <button onClick={() => onWhitelistBatch(false)} className="rounded bg-white/10 px-3 py-2 text-neutral-light hover:bg-white/20">Remove Batch</button>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="text-sm text-neutral-light/80">Deposit Sale Tokens</div>
            <div className="flex gap-2">
              <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="Amount of sale tokens" className="flex-1 rounded bg-white/5 p-2 text-neutral-light" />
              <button onClick={onDepositSale} className="rounded bg-white/10 px-3 py-2 text-neutral-light hover:bg-white/20">Deposit</button>
            </div>
            <div className="text-xs text-neutral-light/60">Note: Approve the pool to spend your sale token before depositing.</div>
          </div>
        </div>
      )}
    </div>
  );
}
