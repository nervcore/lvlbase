import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base], // Kita hanya fokus di Base Mainnet
  connectors: [
    coinbaseWallet({
      appName: 'LvLBASE',
      preference: 'smartWalletOnly', // Agar user diarahkan pakai Smart Wallet (Gasless experience kedepannya)
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});