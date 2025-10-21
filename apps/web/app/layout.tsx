import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import Header from '../components/Header';
import { Space_Grotesk } from 'next/font/google';
import dynamic from 'next/dynamic';
import { Analytics } from '@vercel/analytics/react';
const Providers = dynamic(() => import('./providers'), { ssr: false });
import StarfieldCanvas from '../components/ui/StarfieldCanvas';
import Footer from '../components/Footer';
const SpaceParallax = dynamic(() => import('../components/ui/SpaceParallax'), { ssr: false });
const GoogleAnalytics = dynamic(() => import('../components/analytics/GoogleAnalytics'), { ssr: false });

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.universwap.xyz'),
  title: {
    default: 'Universwap — Multichain DeFi Platform',
    template: '%s | Universwap',
  },
  description:
    'Universwap is a multichain DeFi platform with swaps (Uniswap V3), token factory, liquidity & staking (MasterChef + BentoBox), and launchpad.',
  openGraph: {
    type: 'website',
    title: 'Universwap',
    description:
      'Multichain DeFi: DEX, Token Creator, Liquidity & Staking, Launchpad. Space-themed, SEO-friendly.',
    url: 'https://www.universwap.xyz',
    siteName: 'Universwap',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@universwap',
  },
  alternates: {
    canonical: '/',
    languages: {
      'en': '/en',
      'es': '/es',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: '/brand/images/UNIVERSWAPLOGO.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/brand/images/UNIVERSWAPLOGO.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/brand/images/UNIVERSWAPLOGO.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={clsx(spaceGrotesk.variable)}>
      <body className={clsx('bg-neutral-dark text-neutral-light')}> 
        <SpaceParallax />
        {/* Dark veil over parallax only (below starfield) */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-black/75" />
        <StarfieldCanvas />
        <Providers>
          <div className="flex min-h-screen flex-col">
            <GoogleAnalytics />
            <Analytics />
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
