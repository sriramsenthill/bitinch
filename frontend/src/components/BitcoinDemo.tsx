import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import ECPairFactory from "ecpair";
import { useState } from "react";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export const BitcoinDemo = () => {
  const [sender, setSender] = useState<any>(null);

  const createWalletAndSignMessage = () => {
    try {
      const network = bitcoin.networks.testnet;
      const keypair = ECPair.makeRandom({ network });

      // x-only pubkey for Taproot
      const xOnlyPubkey = Buffer.from(keypair.publicKey).slice(1, 33);

      const { address } = bitcoin.payments.p2tr({
        internalPubkey: xOnlyPubkey,
        network,
      });

      console.log("Address:", address);
      const privateKey = keypair.toWIF();
      console.log("Private Key (WIF):", privateKey);

      // Example message
      const message = "Hello Bitcoin!";
      const messageHash = bitcoin.crypto.sha256(Buffer.from(message));

      // Sign the message hash using Taproot keypair
      const signature = keypair.signSchnorr(messageHash);
      console.log("Message:", message);
      console.log("Signature (hex):", signature);

      setSender({ keypair, address, xOnlyPubkey, network });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div onClick={() => createWalletAndSignMessage()}>
      Create Taproot Wallet & Sign Message
    </div>
  );
};
