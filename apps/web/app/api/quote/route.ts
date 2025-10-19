import { NextResponse } from 'next/server';
import type { Address } from 'viem';
import { quoteAggregatedSwap } from '../../../lib/aggregator';
import type { QuoteMode } from '../../../lib/aggregator/quoteRoute';

export const runtime = 'nodejs';

function isHexAddress(v: any): v is Address {
  return typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chainId = Number(body?.chainId);
    const tokenIn = body?.tokenIn;
    const tokenOut = body?.tokenOut;
    const amountRaw = body?.amount;
    const modeRaw = body?.mode;
    const routesPoolRaw = body?.routesPool;
    const maxRoutesRaw = body?.maxRoutes;

    if (!Number.isInteger(chainId) || chainId <= 0) {
      return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 });
    }
    if (!isHexAddress(tokenIn) || !isHexAddress(tokenOut)) {
      return NextResponse.json({ error: 'Invalid token addresses' }, { status: 400 });
    }

    if (modeRaw !== 'exact-in' && modeRaw !== 'exact-out') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    const mode = modeRaw as QuoteMode;

    if (amountRaw === undefined) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }
    let amount: bigint;
    try {
      amount = BigInt(String(amountRaw));
    } catch {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let routesPool: (Address | string)[] | undefined;
    if (Array.isArray(routesPoolRaw)) {
      routesPool = routesPoolRaw;
    }

    let maxRoutes: number | undefined;
    if (maxRoutesRaw !== undefined) {
      const parsed = Number(maxRoutesRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Invalid maxRoutes' }, { status: 400 });
      }
      maxRoutes = parsed;
    }

    const quote = await quoteAggregatedSwap({
      chainId,
      tokenIn,
      tokenOut,
      amount,
      mode,
      routesPool,
      maxRoutes,
    });

    return NextResponse.json({
      router: quote.router,
      amountIn: quote.amountIn.toString(),
      amountOut: quote.amountOut.toString(),
      path: quote.path,
      chainId,
      mode,
      forwardPrice: quote.forwardPrice,
      reversePrice: quote.reversePrice,
      spreadBps: quote.spreadBps,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal error', detail: String(e?.message || e) }, { status: 500 });
  }
}
