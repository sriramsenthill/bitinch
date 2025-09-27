import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppKitProvider } from './walletProvider/walletProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppKitProvider>
        <div 
          className="min-h-screen w-full"
          style={{
            background: `linear-gradient(180deg, #0c1638 30%, #e06038 100%)`,
          }}
        >
          <App/>
        </div>
    </AppKitProvider>
  </StrictMode>,
)
