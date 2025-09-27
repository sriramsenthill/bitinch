import { useWallet } from "../hooks/useWallet";
import Lottie from "lottie-react";
import animationData from "../../public/1inchLottie.json";

export const Navbar = () => {
    const {address , connector , isConnected, disconnect} = useWallet();
    const handleConnect = async() => {
        await connector();
    }
    
    return (
        <nav className="flex items-center justify-between p-6 bg-transparent">
            
        </nav>
    )
}