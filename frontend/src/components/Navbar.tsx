import { useWallet } from "../hooks/useWallet";

export const Navbar = () => {
    const {address , connector , isConnected, disconnect} = useWallet();
    const handleConnect = async() => {
        await connector();
    }
    
    return (
            <div className="rounded-full px-6 py-3 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center space-x-2">
                    
                </div>

                {/* Connect Wallet Button */}
                {isConnected ? (
                    <div className="flex items-center space-x-3">
                        <div className="bg-green-500 text-white font-semibold px-4 py-2 rounded-full text-sm">
                            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                        </div>
                        <button 
                            onClick={() => disconnect()}
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={handleConnect}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2 rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                        Connect Wallet
                    </button>
                )}
            </div>
    )
}