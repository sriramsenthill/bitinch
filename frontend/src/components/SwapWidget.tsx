import React from 'react';
import { useSwapStore, MOCK_PRICES } from '../stores/swapStore';

export const SwapWidget: React.FC = () => {
  // Zustand store state and actions
  const {
    fromAsset,
    toAsset,
    inputAmount,
    outputAmount,
    quote,
    isQuoteLoading,
    isSwapPending,
    isExchanging,
    exchangeDirection,
    error,
    slippageTolerance,
    deadline,
    setInputAmount,
    swapAssets,
    setError,
    setIsSwapPending,
    resetForm
  } = useSwapStore();

  // Handle swap execution
  const handleSwap = async () => {
    if (!quote || !inputAmount || !outputAmount) {
      setError('Invalid swap parameters');
      return;
    }

    setIsSwapPending(true);
    setError(null);

    try {
      // Simulate swap execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reset form after successful swap
      resetForm();
      alert('Swap executed successfully!');
    } catch (error) {
      setError('Swap failed. Please try again.');
    } finally {
      setIsSwapPending(false);
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
    <div className="max-w-md mx-auto bg-black/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
          Swap
        </h2>
        <p className="text-white/70 text-sm">Trade tokens instantly on Bitcoin</p>
      </div>

      {/* From Asset */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-white/80">From</span>
          <span className="text-xs text-white/60">
            Balance: {formatBalance(fromAsset.balance, fromAsset.decimals)} {fromAsset.symbol}
          </span>
        </div>
        
        <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-orange-400/50 transition-all duration-300 group">
          <div className="flex items-center space-x-4 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {fromAsset.icon}
            </div>
            <div>
              <div className="font-semibold text-white text-lg">{fromAsset.symbol}</div>
              <div className="text-xs text-white/60">{fromAsset.name}</div>
            </div>
          </div>
          
          <div className="text-right">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.00"
              className="text-right text-xl font-semibold bg-transparent border-none outline-none w-32 text-white placeholder-white/40"
            />
            <div className="text-xs text-white/60">
              ≈ {formatPrice(parseFloat(inputAmount || '0') * MOCK_PRICES[fromAsset.symbol as keyof typeof MOCK_PRICES])}
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Button */}
      <div className="flex justify-center my-6">
        <button
          onClick={swapAssets}
          className={`w-12 h-12 rounded-full border-2 border-white/20 bg-black/30 backdrop-blur-sm hover:bg-orange-400/20 hover:border-orange-400/50 flex items-center justify-center transition-all duration-300 ${
            isExchanging ? 'animate-spin' : ''
          }`}
        >
          <svg 
            className={`w-6 h-6 text-white transition-transform duration-300 ${
              exchangeDirection === 'reversed' ? 'rotate-180' : ''
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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-white/80">To</span>
          <span className="text-xs text-white/60">
            Balance: {formatBalance(toAsset.balance, toAsset.decimals)} {toAsset.symbol}
          </span>
        </div>
        
        <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
          <div className="flex items-center space-x-4 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {toAsset.icon}
            </div>
            <div>
              <div className="font-semibold text-white text-lg">{toAsset.symbol}</div>
              <div className="text-xs text-white/60">{toAsset.name}</div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-semibold text-white">
              {isQuoteLoading ? (
                <div className="animate-pulse flex items-center">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce mr-1"></div>
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              ) : (
                outputAmount || '0.00'
              )}
            </div>
            <div className="text-xs text-white/60">
              ≈ {formatPrice(parseFloat(outputAmount || '0') * MOCK_PRICES[toAsset.symbol as keyof typeof MOCK_PRICES])}
            </div>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="mb-6 p-4 bg-gradient-to-r from-orange-400/10 to-pink-400/10 rounded-2xl border border-orange-400/20 backdrop-blur-sm">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-white/70">Rate</span>
            <span className="font-medium text-white">
              1 {fromAsset.symbol} = {quote.exchangeRate.toFixed(6)} {toAsset.symbol}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-white/70">Price Impact</span>
            <span className={`font-medium ${quote.priceImpact > 1 ? 'text-red-400' : 'text-green-400'}`}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/70">Minimum Received</span>
            <span className="font-medium text-white">
              {quote.minimumReceived.toFixed(6)} {toAsset.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-400/10 rounded-2xl border border-red-400/20 backdrop-blur-sm">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!quote || isSwapPending || isQuoteLoading}
        className={`w-full py-5 rounded-2xl font-semibold text-lg transition-all duration-300 ${
          !quote || isSwapPending || isQuoteLoading
            ? 'bg-white/10 text-white/50 cursor-not-allowed border border-white/20'
            : 'bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white transform hover:scale-105 shadow-2xl hover:shadow-orange-400/25'
        }`}
      >
        {isSwapPending ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            Swapping...
          </div>
        ) : isQuoteLoading ? (
          'Getting Quote...'
        ) : !inputAmount ? (
          'Enter Amount'
        ) : (
          'Swap'
        )}
      </button>

      {/* Settings */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center text-xs text-white/60">
          <span>Slippage: {slippageTolerance}%</span>
          <span>Deadline: {deadline}min</span>
        </div>
      </div>
    </div>
  );
};