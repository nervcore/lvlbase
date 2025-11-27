'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { useState, type ReactNode } from 'react';

// Konfigurasi Wagmi yang lebih robust untuk Farcaster
const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'LvLBASE',
      // 'all' memungkinkan support smart wallet (passkey) DAN mobile wallet
      // Ini memberikan UX terbaik di berbagai platform (Farcaster/Browser)
      preference: 'all', 
    }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true, // Penting untuk Next.js App Router
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
