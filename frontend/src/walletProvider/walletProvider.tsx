import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { arbitrum, bsc, polygon, arbitrumSepolia,base, berachainTestnetbArtio, berachain, citreaTestnet, corn, mainnet, bscTestnet, avalanche, optimism, sepolia, baseSepolia, type AppKitNetwork} from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from 'viem'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

const projectId = 'c32da378a969668c82ece2cd17505b7c'

const metadata = {
  name: 'AppKit',
  description: 'AppKit Example',
  url: 'https://appkit.example.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

export const SupportedChains : AppKitNetwork[] = [
    mainnet,
    arbitrum,
    polygon,
    optimism,
    bsc,
    avalanche,
    arbitrumSepolia,
    sepolia,
    baseSepolia,
    base,
    berachainTestnetbArtio,
    berachain,
    citreaTestnet,
    corn,
    bscTestnet
] as const;



// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks : SupportedChains,
  projectId,
  ssr: true
})


// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: SupportedChains as [AppKitNetwork, ...AppKitNetwork[]],
  projectId,    
  metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

export function AppKitProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}