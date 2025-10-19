import { NextResponse } from 'next/server';
import type { Address } from 'viem';
import { getTokensForChain } from '../../../lib/tokens';
import { quoteV2Routers } from '../../../lib/aggregator';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const chainId = 97; // BSC Testnet
    const tokenMap = getTokensForChain(chainId) || {};
    const symbols = Object.keys(tokenMap);

    // Build candidate pairs (unique unordered pairs)
    const pairs: { from: string; to: string }[] = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        pairs.push({ from: symbols[i], to: symbols[j] });
      }
    }

    const results: any[] = [];

    // Scan pairs by attempting a small quote in both directions
    for (const p of pairs) {
      const from = (tokenMap as any)[p.from];
      const to = (tokenMap as any)[p.to];
      if (!from?.address || !to?.address) continue;

      const pathFT: Address[] = [from.address as Address, to.address as Address];
      const pathTF: Address[] = [to.address as Address, from.address as Address];

      // Use 1 unit (scaled by decimals) to probe liquidity
      const unitInFrom = 10n ** BigInt(from.decimals || 18);
      const unitInTo = 10n ** BigInt(to.decimals || 18);

      const [qFT, qTF] = await Promise.all([
        quoteV2Routers({ chainId, amountIn: unitInFrom, path: pathFT }),
        quoteV2Routers({ chainId, amountIn: unitInTo, path: pathTF }),
      ]);

      const okFT = qFT?.amountOut && qFT.amountOut > 0n;
      const okTF = qTF?.amountOut && qTF.amountOut > 0n;

      if (okFT || okTF) {
        results.push({
          pair: `${p.from}/${p.to}`,
          forward: okFT ? {
            amountIn: unitInFrom.toString(),
            amountOut: qFT!.amountOut!.toString(),
            router: qFT!.router?.name,
            path: pathFT,
          } : null,
          reverse: okTF ? {
            amountIn: unitInTo.toString(),
            amountOut: qTF!.amountOut!.toString(),
            router: qTF!.router?.name,
            path: pathTF,
          } : null,
        });
      }
    }

    // Sort: pairs with both directions first, then by forward amountOut desc
    results.sort((a, b) => {
      const aBoth = a.forward && a.reverse ? 1 : 0;
      const bBoth = b.forward && b.reverse ? 1 : 0;
      if (bBoth !== aBoth) return bBoth - aBoth;
      const av = a.forward ? BigInt(a.forward.amountOut) : 0n;
      const bv = b.forward ? BigInt(b.forward.amountOut) : 0n;
      return bv > av ? 1 : -1;
    });

    return NextResponse.json({ chainId, tokens: symbols, pairs: results });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal error', detail: String(e?.message || e) }, { status: 500 });
  }
}