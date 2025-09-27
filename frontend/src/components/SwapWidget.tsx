import React from 'react';
import { useSwapStore, assets } from '../stores/swapStore';
import { ArrowDownUp } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

export const SwapWidget: React.FC = () => {
  const {
    fromAsset,
    toAsset,
    inputAmount,
    outputAmount,
    quote,
    isQuoteLoading,
    isSwapPending,
    setInputAmount,
    setOutputAmount,
    setFromAsset,
    setToAsset,
    swapAssets,
    setError,
    setIsSwapPending,
    resetForm
  } = useSwapStore();

  const { address, isConnected, connector } = useWallet();

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !inputAmount || !outputAmount) {
      setError('Invalid swap parameters');
      return;
    }

    setIsSwapPending(true);
    setError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      resetForm();
      alert('Swap executed successfully!');
    } catch (error) {
      setError('Swap failed. Please try again.');
    } finally {
      setIsSwapPending(false);
    }
  };

  // Connect wallet
  const handleConnect = async () => {
    await connector();
  };

  // Available assets list (from your store definition)
  const assetList = Object.values(assets);

  return (
    <div className="min-h-[70vh] flex justify-center items-center">
      <div className="w-[500px] bg-blue-950/60 text-white backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 px-4 py-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-6 relative">
            {/* From Asset */}
            <div className="bg-blue-950/70 p-2 rounded-lg h-18 flex items-center justify-between px-3">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="outline-none bg-transparent flex-1 mr-3"
                placeholder="Enter input amount"
              />
              <div className="flex items-center gap-2">
                <img src={fromAsset.icon} alt={fromAsset.symbol} className="w-6 h-6 rounded-full" />
                <select
                  value={fromAsset.symbol}
                  onChange={(e) => {
                    const selected = assetList.find((a) => a.symbol === e.target.value);
                    if (selected) setFromAsset(selected);
                  }}
                  className="bg-transparent outline-none cursor-pointer"
                >
                  {assetList.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Arrow */}
            <div
              className="p-2 rounded-full w-fit h-fit bg-amber-800/60 absolute left-[43%] top-[37%] cursor-pointer hover:bg-amber-700/60 transition"
              onClick={() => swapAssets()}
            >
              <ArrowDownUp />
            </div>

            {/* To Asset */}
            <div className="bg-blue-950/70 p-2 rounded-lg h-18 flex items-center justify-between px-3">
              <input
                type="number"
                value={outputAmount}
                onChange={(e) => setOutputAmount(e.target.value)}
                className="outline-none bg-transparent flex-1 mr-3"
                placeholder="Enter output amount"
              />
              <div className="flex items-center gap-2">
                <img src={toAsset.icon} alt={toAsset.symbol} className="w-6 h-6 rounded-full" />
                <select
                  value={toAsset.symbol}
                  onChange={(e) => {
                    const selected = assetList.find((a) => a.symbol === e.target.value);
                    if (selected) setToAsset(selected);
                  }}
                  className="bg-transparent outline-none cursor-pointer"
                >
                  {assetList.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={isConnected ? handleSwap : handleConnect}
            disabled={isSwapPending || isQuoteLoading}
            className={`px-4 py-2 mt-3 rounded-2xl transition bg-amber-700/60
              ${isSwapPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isSwapPending
              ? 'Swapping...'
              : isConnected
              ? 'Swap'
              : 'Connect EVM Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
};
