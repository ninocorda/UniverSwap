'use client';

import Image from 'next/image';

type Brand = {
  name: string;
  tag: string;
  logo: string;
};
const BRANDS: Brand[] = [
  {
    name: 'BNB Chain',
    tag: 'BSC Mainnet',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
  },
  {
    name: 'Ethereum',
    tag: 'ETH Mainnet',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
  },
  {
    name: 'Polygon',
    tag: 'PoS Network',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
  },
  {
    name: 'Arbitrum',
    tag: 'Layer 2',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png',
  },
  {
    name: 'Optimism',
    tag: 'Layer 2',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png',
  },
  {
    name: 'Avalanche',
    tag: 'C-Chain',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png',
  },
  {
    name: 'Chainlink',
    tag: 'Data Feeds',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png',
  },
];

const MARQUEE_ITEMS = [...BRANDS, ...BRANDS];

export function BackedByStrip() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-[100vw] overflow-hidden rounded-xl border border-white/10 bg-white/5 py-6 backdrop-blur">
      <div className="flex items-center gap-10 px-10">
        <span className="text-xs font-semibold uppercase tracking-[0.45em] text-secondary">Backed By</span>
        <div className="relative flex-1 overflow-hidden">
          <div className="marquee-track">
            {MARQUEE_ITEMS.map((brand, index) => (
              <MarqueeCard key={`${brand.name}-${index}`} brand={brand} />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .marquee-track {
          display: inline-flex;
          align-items: center;
          gap: 1.75rem;
          min-width: max-content;
          animation: universwap-marquee 28s linear infinite;
          will-change: transform;
        }
        @keyframes universwap-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

function MarqueeCard({ brand }: { brand: Brand }) {
  return (
    <div className="flex min-w-[10rem] items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-neutral-light/80 shadow-sm backdrop-blur">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
        <Image src={brand.logo} alt={`${brand.name} logo`} fill sizes="44px" className="object-contain" priority />
      </div>
      <div className="text-left">
        <div className="font-medium text-neutral-light">{brand.name}</div>
        <div className="text-xs uppercase tracking-wide text-neutral-light/60">{brand.tag}</div>
      </div>
    </div>
  );
}
