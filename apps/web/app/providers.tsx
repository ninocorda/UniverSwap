'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { bscTestnet } from 'viem/chains';
import { ReactNode, useEffect, useState } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import { LanguageProvider } from '../lib/i18n/LanguageContext';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'WALLETCONNECT_PROJECT_ID';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<any | null>(null);

  // Initialize only on client after mount
  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== 'undefined') {
        const cfg = getDefaultConfig({
          appName: 'Universwap',
          projectId: walletConnectProjectId,
          chains: [bscTestnet],
          ssr: true,
        });
        setConfig(cfg);
      }
    } catch {
      // leave config null to avoid SSR issues
    }
  }, []);

  // Do not render children until Wagmi/RainbowKit are ready; avoids hooks being
  // called outside the provider during the initial hydration.
  if (!mounted || !config) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ToastProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
