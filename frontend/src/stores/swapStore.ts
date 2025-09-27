import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Asset interface
export interface Asset {
  id: number;
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  balance?: number;
}

export const assets = {
  eth: {
    id: 1,
    symbol: "ETH",
    name: "Ethereum",
    icon: "https://garden.imgix.net/chain_images/ethereum.svg",
    decimals: 18
  },
  btc: {
    id: 2,
    symbol: "BTC",
    name: "Bitcoin",
    icon: "https://garden.imgix.net/token-images/bitcoin.svg",
    decimals: 8
  }
}

// Quote interface
export interface Quote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  priceImpact: number;
  minimumReceived: number;
  slippage: number;
  timestamp: number;
}

// Swap state interface
export interface SwapState {
  // Asset selection
  fromAsset: Asset;
  toAsset: Asset;
  
  // Amounts
  inputAmount: string;
  outputAmount: string;
  
  // Quote data
  quote: Quote | null;
  
  // UI states
  isQuoteLoading: boolean;
  isSwapPending: boolean;
  showQuoteDetails: boolean;
  
  // Exchange states
  isExchanging: boolean;
  exchangeDirection: 'normal' | 'reversed';
  
  // Error states
  error: string | null;
  warning: string | null;
  
  // Slippage and settings
  slippageTolerance: number;
  deadline: number;
  
  // Price data
  currentPrice: number;
  priceChange24h: number;
}

// Mock price data
export const MOCK_PRICES = {
  BTC: 45000,
  ETH: 3000
};

// Mock exchange rates
export const MOCK_EXCHANGE_RATES = {
  'BTC-ETH': 0.0667, // 1 BTC = 0.0667 ETH
  'ETH-BTC': 15.0    // 1 ETH = 15 BTC
};

// Actions interface
interface SwapActions {
  // Input handling
  setInputAmount: (amount: string) => void;
  setOutputAmount: (amount: string) => void;  
  // Asset selection
  setFromAsset: (asset: Asset) => void;
  setToAsset: (asset: Asset) => void;
  swapAssets: () => void;
  
  // Quote handling
  calculateQuote: (amount: string, fromAsset: Asset, toAsset: Asset) => Promise<void>;
  setQuote: (quote: Quote | null) => void;
  
  // UI state
  setIsQuoteLoading: (loading: boolean) => void;
  setIsSwapPending: (pending: boolean) => void;
  setShowQuoteDetails: (show: boolean) => void;
  setIsExchanging: (exchanging: boolean) => void;
  setExchangeDirection: (direction: 'normal' | 'reversed') => void;
  
  // Error handling
  setError: (error: string | null) => void;
  setWarning: (warning: string | null) => void;
  
  // Settings
  setSlippageTolerance: (slippage: number) => void;
  setDeadline: (deadline: number) => void;
  
  // Price data
  setCurrentPrice: (price: number) => void;
  setPriceChange24h: (change: number) => void;
  
  // Reset
  resetSwap: () => void;
  resetForm: () => void;
}

// Initial state
const initialState: SwapState = {
  fromAsset: assets.btc, // BTC
  toAsset: assets.eth,    // ETH
  inputAmount: '',
  outputAmount: '',
  quote: null,
  isQuoteLoading: false,
  isSwapPending: false,
  showQuoteDetails: false,
  isExchanging: false,
  exchangeDirection: 'normal',
  error: null,
  warning: null,
  slippageTolerance: 0.5, // 0.5%
  deadline: 20, // 20 minutes
  currentPrice: MOCK_PRICES.BTC,
  priceChange24h: 2.5
};

// Create the store
export const useSwapStore = create<SwapState & SwapActions>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Input handling
      setInputAmount: (amount: string) => {
        set({ inputAmount: amount });
        const { fromAsset, toAsset } = get();
        if (amount) {
          get().calculateQuote(amount, fromAsset, toAsset);
        }
      },
      
      setOutputAmount: (amount: string) => {
        set({ outputAmount: amount });
      },
      
      // Asset selection
      setFromAsset: (asset: Asset) => {
        set({ fromAsset: asset });
        const { inputAmount } = get();
        if (inputAmount) {
          get().calculateQuote(inputAmount, asset, get().toAsset);
        }
      },
      
      setToAsset: (asset: Asset) => {
        set({ toAsset: asset });
        const { inputAmount, fromAsset } = get();
        if (inputAmount) {
          get().calculateQuote(inputAmount, fromAsset, asset);
        }
      },
      
      swapAssets: () => {
        const { fromAsset, toAsset, inputAmount, outputAmount, exchangeDirection } = get();
        set({
          fromAsset: toAsset,
          toAsset: fromAsset,
          inputAmount: outputAmount,
          outputAmount: inputAmount,
          isExchanging: true,
          exchangeDirection: exchangeDirection === 'normal' ? 'reversed' : 'normal'
        });
        
        // Reset exchange animation after delay
        setTimeout(() => {
          set({ isExchanging: false });
        }, 300);
      },
      
      // Quote handling
      calculateQuote: async (amount: string, fromAsset: Asset, toAsset: Asset) => {
        if (!amount || parseFloat(amount) <= 0) {
          set({
            quote: null,
            outputAmount: '',
            error: null
          });
          return;
        }

        set({ isQuoteLoading: true, error: null });

        try {
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 1000));

          const inputAmount = parseFloat(amount);
          const exchangeRate = MOCK_EXCHANGE_RATES[`${fromAsset.symbol}-${toAsset.symbol}` as keyof typeof MOCK_EXCHANGE_RATES];
          
          if (!exchangeRate) {
            throw new Error('Exchange rate not available');
          }

          const outputAmount = inputAmount * exchangeRate;
          const priceImpact = Math.random() * 2; // Mock price impact
          const slippage = get().slippageTolerance;
          const minimumReceived = outputAmount * (1 - slippage / 100);

          const quote: Quote = {
            inputAmount,
            outputAmount,
            exchangeRate,
            priceImpact,
            minimumReceived,
            slippage,
            timestamp: Date.now()
          };

          set({
            quote,
            outputAmount: outputAmount.toFixed(6),
            isQuoteLoading: false,
            error: null
          });

        } catch (error) {
          set({
            isQuoteLoading: false,
            error: error instanceof Error ? error.message : 'Failed to get quote',
            quote: null,
            outputAmount: ''
          });
        }
      },
      
      setQuote: (quote: Quote | null) => {
        set({ quote });
      },
      
      // UI state
      setIsQuoteLoading: (loading: boolean) => {
        set({ isQuoteLoading: loading });
      },
      
      setIsSwapPending: (pending: boolean) => {
        set({ isSwapPending: pending });
      },
      
      setShowQuoteDetails: (show: boolean) => {
        set({ showQuoteDetails: show });
      },
      
      setIsExchanging: (exchanging: boolean) => {
        set({ isExchanging: exchanging });
      },
      
      setExchangeDirection: (direction: 'normal' | 'reversed') => {
        set({ exchangeDirection: direction });
      },
      
      // Error handling
      setError: (error: string | null) => {
        set({ error });
      },
      
      setWarning: (warning: string | null) => {
        set({ warning });
      },
      
      // Settings
      setSlippageTolerance: (slippage: number) => {
        set({ slippageTolerance: slippage });
      },
      
      setDeadline: (deadline: number) => {
        set({ deadline });
      },
      
      // Price data
      setCurrentPrice: (price: number) => {
        set({ currentPrice: price });
      },
      
      setPriceChange24h: (change: number) => {
        set({ priceChange24h: change });
      },
      
      // Reset
      resetSwap: () => {
        set(initialState);
      },
      
      resetForm: () => {
        set({
          inputAmount: '',
          outputAmount: '',
          quote: null,
          error: null,
          warning: null
        });
      }
    }),
    {
      name: 'swap-store',
    }
  )
);
