"use client";

import { useCallback, useMemo, useState } from "react";
import { Address, Hex, maxUint256, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { ERC20_ABI } from "../lib/abis/erc20";
import { V2_ROUTER_ABI } from "../lib/abis/v2router";
import { getWrappedNativeAddress } from "../lib/tokens";

export type SwapParams = {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string; // decimal string
  amountOutQuoted: string; // decimal string from /api/quote
  tokenInDecimals: number;
  tokenOutDecimals: number;
  router: Address; // from /api/quote
  slippageBps: number; // e.g. 50 = 0.5%
  isNativeIn?: boolean;
  isNativeOut?: boolean;
  path?: Address[]; // full V2 path from quote (must be provided for multi-hop)
};

export type SwapState = {
  approving: boolean;
  swapping: boolean;
  txHash?: Hex;
  error?: string;
};

function formatUnitsSafe(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const s = value.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

function calcMinOut(quotedOut: bigint, slippageBps: number): bigint {
  if (!slippageBps) return quotedOut;
  const bps = BigInt(slippageBps);
  return quotedOut - (quotedOut * bps) / 10_000n;
}

export function useSwap() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [state, setState] = useState<SwapState>({ approving: false, swapping: false });

  const approveIfNeeded = useCallback(
    async (token: Address, owner: Address, spender: Address, amount: bigint) => {
      if (!publicClient || !walletClient) throw new Error("Wallet not ready");
      const allowance = (await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
      })) as bigint;
      if (allowance >= amount) return null;
      setState((s) => ({ ...s, approving: true, error: undefined }));
      const hash = await walletClient.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, maxUint256],
        chain: walletClient.chain,
        account: owner,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setState((s) => ({ ...s, approving: false }));
      return hash;
    },
    [publicClient, walletClient]
  );

  function friendlyError(e: any): string {
    const msg = String(e?.shortMessage || e?.message || e || '').toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected')) return 'User rejected the transaction';
    if (msg.includes('insufficient output amount')) return 'Insufficient output amount (slippage too low or price moved)';
    if (msg.includes('transfer_from_failed')) return 'Token transfer failed (check allowance and balance)';
    if (msg.includes('expired') || msg.includes('deadline')) return 'Transaction deadline exceeded';
    if (msg.includes('insufficient funds')) return 'Insufficient native balance to cover value and gas';
    if (msg.includes('unpredictable') || msg.includes('cannot estimate gas')) return 'Cannot estimate gas (pool may have no liquidity)';
    return e?.shortMessage || e?.message || 'Swap failed';
  }

  const swapExactTokensForTokens = useCallback(
    async (params: SwapParams) => {
      try {
        if (!publicClient || !walletClient || !address) throw new Error("Wallet not connected");
        const amountInWei = parseUnits(params.amountIn as `${number}` as string, params.tokenInDecimals);
        const quotedOutWei = parseUnits(params.amountOutQuoted as `${number}` as string, params.tokenOutDecimals);
        const minOutWei = calcMinOut(quotedOutWei, params.slippageBps);

        const to: Address = address as Address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 min
        const wNative = getWrappedNativeAddress(chainId || 0);
        if ((params.isNativeIn || params.isNativeOut) && !wNative) throw new Error("Wrapped native address not configured for this chain");

        setState((s) => ({ ...s, swapping: true, error: undefined }));

        // Native IN -> ERC20 OUT
        if (params.isNativeIn && !params.isNativeOut) {
          const path: Address[] = params.path && params.path.length >= 2 ? params.path : [wNative as Address, params.tokenOut];
          const tx = await walletClient.writeContract({
            address: params.router,
            abi: V2_ROUTER_ABI,
            functionName: "swapExactETHForTokens",
            args: [minOutWei, path, to, deadline],
            chain: walletClient.chain,
            account: address as Address,
            value: amountInWei,
          });
          // expose tx hash for pending UI
          setState((s) => ({ ...s, txHash: tx }));
          const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
          setState({ approving: false, swapping: false, txHash: tx });
          return { txHash: tx, receipt };
        }

        // ERC20 IN -> Native OUT
        if (!params.isNativeIn && params.isNativeOut) {
          // Approve tokenIn
          await approveIfNeeded(params.tokenIn, address as Address, params.router, amountInWei);
          const path: Address[] = params.path && params.path.length >= 2 ? params.path : [params.tokenIn, wNative as Address];
          const tx = await walletClient.writeContract({
            address: params.router,
            abi: V2_ROUTER_ABI,
            functionName: "swapExactTokensForETH",
            args: [amountInWei, minOutWei, path, to, deadline],
            chain: walletClient.chain,
            account: address as Address,
          });
          setState((s) => ({ ...s, txHash: tx }));
          const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
          setState({ approving: false, swapping: false, txHash: tx });
          return { txHash: tx, receipt };
        }

        // ERC20 -> ERC20
        await approveIfNeeded(params.tokenIn, address as Address, params.router, amountInWei);
        const path: Address[] = params.path && params.path.length >= 2 ? params.path : [params.tokenIn, params.tokenOut];
        const tx = await walletClient.writeContract({
          address: params.router,
          abi: V2_ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [amountInWei, minOutWei, path, to, deadline],
          chain: walletClient.chain,
          account: address as Address,
        });
        setState((s) => ({ ...s, txHash: tx }));
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        setState({ approving: false, swapping: false, txHash: tx });
        return { txHash: tx, receipt };
      } catch (e: any) {
        setState((s) => ({ ...s, approving: false, swapping: false, error: friendlyError(e) }));
        throw e;
      }
    },
    [address, approveIfNeeded, publicClient, walletClient]
  );

  return { ...state, approveIfNeeded, swapExactTokensForTokens, formatUnitsSafe };
}
