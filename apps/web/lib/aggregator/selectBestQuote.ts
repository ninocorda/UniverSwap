import { QuoteRouteResult } from './quoteRoute';
import { QuoteMode } from './quoteRoute';

export type SelectedQuote = QuoteRouteResult | null;

export function selectBestQuote(quotes: QuoteRouteResult[], mode: QuoteMode): SelectedQuote {
  if (!quotes || quotes.length === 0) return null;

  if (mode === 'exact-in') {
    let best: QuoteRouteResult | null = null;
    for (const quote of quotes) {
      if (!best || quote.forwardPrice > best.forwardPrice) {
        best = quote;
      }
    }
    return best;
  }

  let best: QuoteRouteResult | null = null;
  for (const quote of quotes) {
    if (!best || quote.reversePrice < best.reversePrice) {
      best = quote;
    }
  }
  return best;
}
