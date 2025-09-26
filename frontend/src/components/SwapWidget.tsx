import React, { useState, useEffect, useCallback } from 'react';

// Asset interface
interface Asset {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  balance?: number;
}

// Quote interface
interface Quote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  priceImpact: number;
  minimumReceived: number;
  slippage: number;
  timestamp: number;
}

// Swap state interface
interface SwapState {
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

// Default assets
const DEFAULT_ASSETS: Asset[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '₿',
    decimals: 8,
    balance: 0.5
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'Ξ',
    decimals: 18,
    balance: 2.5
  }
];

// Mock price data (in real app, this would come from API)
const MOCK_PRICES = {
  BTC: 45000,
  ETH: 3000
};

// Mock exchange rates
const MOCK_EXCHANGE_RATES = {
  'BTC-ETH': 0.0667, // 1 BTC = 0.0667 ETH
  'ETH-BTC': 15.0    // 1 ETH = 15 BTC
};

export const SwapWidget: React.FC = () => {
  // Main swap state
  const [swapState, setSwapState] = useState<SwapState>({
    fromAsset: DEFAULT_ASSETS[0], // BTC
    toAsset: DEFAULT_ASSETS[1],    // ETH
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
  });

  // Calculate quote when input amount changes
  const calculateQuote = useCallback(async (amount: string, fromAsset: Asset, toAsset: Asset) => {
    if (!amount || parseFloat(amount) <= 0) {
      setSwapState(prev => ({
        ...prev,
        quote: null,
        outputAmount: '',
        error: null
      }));
      return;
    }

    setSwapState(prev => ({ ...prev, isQuoteLoading: true, error: null }));

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
      const slippage = swapState.slippageTolerance;
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

      setSwapState(prev => ({
        ...prev,
        quote,
        outputAmount: outputAmount.toFixed(6),
        isQuoteLoading: false,
        error: null
      }));

    } catch (error) {
      setSwapState(prev => ({
        ...prev,
        isQuoteLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get quote',
        quote: null,
        outputAmount: ''
      }));
    }
  }, [swapState.slippageTolerance]);

  // Handle input amount change
  const handleInputChange = (value: string) => {
    setSwapState(prev => ({ ...prev, inputAmount: value }));
    
    if (value) {
      calculateQuote(value, swapState.fromAsset, swapState.toAsset);
    }
  };

  // Handle asset swap (exchange direction)
  const handleAssetSwap = () => {
    setSwapState(prev => ({
      ...prev,
      fromAsset: prev.toAsset,
      toAsset: prev.fromAsset,
      inputAmount: prev.outputAmount,
      outputAmount: prev.inputAmount,
      isExchanging: true,
      exchangeDirection: prev.exchangeDirection === 'normal' ? 'reversed' : 'normal'
    }));

    // Reset exchange animation after delay
    setTimeout(() => {
      setSwapState(prev => ({ ...prev, isExchanging: false }));
    }, 300);
  };

  // Handle swap execution
  const handleSwap = async () => {
    if (!swapState.quote || !swapState.inputAmount || !swapState.outputAmount) {
      setSwapState(prev => ({ ...prev, error: 'Invalid swap parameters' }));
      return;
    }

    setSwapState(prev => ({ ...prev, isSwapPending: true, error: null }));

    try {
      // Simulate swap execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reset form after successful swap
      setSwapState(prev => ({
        ...prev,
        inputAmount: '',
        outputAmount: '',
        quote: null,
        isSwapPending: false,
        error: null
      }));

      alert('Swap executed successfully!');
    } catch (error) {
      setSwapState(prev => ({
        ...prev,
        isSwapPending: false,
        error: 'Swap failed. Please try again.'
      }));
    }
  };

  // Format balance display
  const formatBalance = (balance: number | undefined, decimals: number) => {
    if (balance === undefined) return '0.00';
    return balance.toFixed(decimals > 8 ? 4 : 8);
  };

  // Format price display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Swap</h2>
        <p className="text-gray-600 text-sm">Trade tokens instantly</p>
      </div>

      {/* From Asset */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">From</span>
          <span className="text-xs text-gray-500">
            Balance: {formatBalance(swapState.fromAsset.balance, swapState.fromAsset.decimals)} {swapState.fromAsset.symbol}
          </span>
        </div>
        
        <div className="flex items-center bg-gray-50 rounded-xl p-4 border-2 border-gray-200 focus-within:border-blue-500 transition-colors">
          <div className="flex items-center space-x-3 flex-1">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
              {swapState.fromAsset.icon}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{swapState.fromAsset.symbol}</div>
              <div className="text-xs text-gray-500">{swapState.fromAsset.name}</div>
            </div>
          </div>
          
          <div className="text-right">
            <input
              type="number"
              value={swapState.inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="0.00"
              className="text-right text-lg font-semibold bg-transparent border-none outline-none w-32"
            />
            <div className="text-xs text-gray-500">
              ≈ {formatPrice(parseFloat(swapState.inputAmount || '0') * MOCK_PRICES[swapState.fromAsset.symbol as keyof typeof MOCK_PRICES])}
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Button */}
      <div className="flex justify-center my-4">
        <button
          onClick={handleAssetSwap}
          className={`w-10 h-10 rounded-full border-2 border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center transition-all duration-300 ${
            swapState.isExchanging ? 'animate-spin' : ''
          }`}
        >
          <svg 
            className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
              swapState.exchangeDirection === 'reversed' ? 'rotate-180' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To Asset */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">To</span>
          <span className="text-xs text-gray-500">
            Balance: {formatBalance(swapState.toAsset.balance, swapState.toAsset.decimals)} {swapState.toAsset.symbol}
          </span>
        </div>
        
        <div className="flex items-center bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
          <div className="flex items-center space-x-3 flex-1">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {swapState.toAsset.icon}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{swapState.toAsset.symbol}</div>
              <div className="text-xs text-gray-500">{swapState.toAsset.name}</div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">
              {swapState.isQuoteLoading ? (
                <div className="animate-pulse">...</div>
              ) : (
                swapState.outputAmount || '0.00'
              )}
            </div>
            <div className="text-xs text-gray-500">
              ≈ {formatPrice(parseFloat(swapState.outputAmount || '0') * MOCK_PRICES[swapState.toAsset.symbol as keyof typeof MOCK_PRICES])}
            </div>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {swapState.quote && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Rate</span>
            <span className="font-medium">
              1 {swapState.fromAsset.symbol} = {swapState.quote.exchangeRate.toFixed(6)} {swapState.toAsset.symbol}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-600">Price Impact</span>
            <span className={`font-medium ${swapState.quote.priceImpact > 1 ? 'text-red-600' : 'text-green-600'}`}>
              {swapState.quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-600">Minimum Received</span>
            <span className="font-medium">
              {swapState.quote.minimumReceived.toFixed(6)} {swapState.toAsset.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {swapState.error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 text-sm">{swapState.error}</div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!swapState.quote || swapState.isSwapPending || swapState.isQuoteLoading}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 ${
          !swapState.quote || swapState.isSwapPending || swapState.isQuoteLoading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-105 shadow-lg hover:shadow-xl'
        }`}
      >
        {swapState.isSwapPending ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Swapping...
          </div>
        ) : swapState.isQuoteLoading ? (
          'Getting Quote...'
        ) : !swapState.inputAmount ? (
          'Enter Amount'
        ) : (
          'Swap'
        )}
      </button>

      {/* Settings */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Slippage: {swapState.slippageTolerance}%</span>
          <span>Deadline: {swapState.deadline}min</span>
        </div>
      </div>
    </div>
  );
};
