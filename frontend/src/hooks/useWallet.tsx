import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useConnect, useDisconnect, useWalletClient } from "wagmi";

export const useWallet = () => {
  const { data: walletClient } = useWalletClient();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect} = useDisconnect();
  const { status, connectors, isPending, connectAsync } = useConnect();
  const chainId = useAppKitNetwork();

  return {
    walletClient,
    address,
    connectors,
    isPending,
    connector: open,
    isConnected,
    status,
    disconnect,
    connectAsync,
    chainId,
  };
};
