use crate::tx_utils::{
    build_input, build_output, build_transaction, compute_taproot_sighash, derive_keypair,
    sign_schnorr,
};
use crate::utils::Utxo;
use crate::swap::{Bitcoin, HTLCType};
use bitcoin::{
    opcodes,
    script::PushBytesBuf,
    secp256k1::Secp256k1,
    taproot::{LeafVersion, TaprootBuilder, TaprootBuilderError, TaprootSpendInfo},
    Address, Amount, KnownHrp, OutPoint, ScriptBuf, TapLeafHash, TapSighashType, Transaction,
    TxOut, Txid, Witness, XOnlyPublicKey,
};
use log::{error, info};
use std::str::FromStr;
use thiserror::Error;

// Well-recognized NUMS point from BIP-341 (SHA-256 of generator point's compressed public key)
const NUMS_POINT: &str = "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";

#[derive(Error, Debug)]
pub enum TaprootError {
    #[error("Invalid HTLC type for P2TR address: {0}")]
    InvalidHtlcType(String),
    #[error("Timelock must be positive")]
    InvalidTimelock,
    #[error("Invalid NUMS point: {0}")]
    InvalidNumsPoint(String),
    #[error("Failed to build Taproot spend info")]
    TaprootBuildError,
    #[error("Invalid payment hash: {0}")]
    InvalidPaymentHash(String),
    #[error("Failed to create PushBytesBuf: {0}")]
    PushBytesBufError(String),
    #[error("Invalid responder pubkey: {0}")]
    InvalidResponderPubkey(String),
    #[error("Invalid initiator pubkey: {0}")]
    InvalidInitiatorPubkey(String),
    #[error("Failed to get control block")]
    ControlBlockError,
    #[error("Invalid preimage hex: {0}")]
    InvalidPreimage(String),
    #[error("Failed to compute sighash for input {index}: {error}")]
    SighashError { index: usize, error: String },
    #[error("Invalid Txid: {0}")]
    InvalidTxid(String),
    #[error("Invalid private key: {0}")]
    InvalidPrivateKey(String),
    #[error("Taproot builder error: {0}")]
    TaprootBuilderError(String),
}

impl From<std::io::Error> for TaprootError {
    fn from(e: std::io::Error) -> Self {
        TaprootError::InvalidPrivateKey(e.to_string())
    }
}

impl From<TaprootBuilderError> for TaprootError {
    fn from(e: TaprootBuilderError) -> Self {
        TaprootError::TaprootBuilderError(e.to_string())
    }
}

pub fn generate_p2tr_address(
    bitcoin: &Bitcoin,
    network: KnownHrp,
) -> Result<(Address, TaprootSpendInfo), TaprootError> {
    if HTLCType::P2tr2 != bitcoin.htlc_type {
        return Err(TaprootError::InvalidHtlcType(format!(
            "{:?}",
            bitcoin.htlc_type
        )));
    }
    let secp = Secp256k1::new();
    let taproot_spend_info = get_spending_info(bitcoin)?;
    let address = Address::p2tr(
        &secp,
        taproot_spend_info.internal_key(),
        taproot_spend_info.merkle_root(),
        network,
    );
    info!("Generated P2TR address: {}", address);
    Ok((address, taproot_spend_info))
}

pub fn redeem_taproot_htlc(
    bitcoin: &Bitcoin,
    preimage: &str,
    receiver_private_key: &str,
    utxos: Vec<Utxo>,
    transfer_to_address: &Address,
    fee_rate_per_vb: u64,
    network: KnownHrp,
) -> Result<Transaction, TaprootError> {
    let secp = Secp256k1::new();
    info!("Starting P2TR redeem for bitcoin: {:?}", bitcoin);

    // 1️⃣ Generate Taproot spend info (address + spend tree)
    let (htlc_address, spend_info) = generate_p2tr_address(bitcoin, network)?;

    // 2️⃣ Get the HTLC redeem script and control block
    let redeem_script = p2tr2_redeem_script(&bitcoin.payment_hash, &bitcoin.responder_pubkey)?;
    let script_ver = (redeem_script.clone(), LeafVersion::TapScript);

    let control_block = spend_info
        .control_block(&script_ver)
        .ok_or(TaprootError::ControlBlockError)?;

    // 3️⃣ Derive receiver's keypair
    let keypair = derive_keypair(receiver_private_key)
        .map_err(|e| TaprootError::InvalidPrivateKey(e.to_string()))?;

    // 4️⃣ Prepare inputs, prevouts, and total input amount
    let mut inputs = Vec::new();
    let mut prevouts = Vec::new();
    let mut total_amount = Amount::from_sat(0);

    for utxo in &utxos {
        let prev_txid =
            Txid::from_str(&utxo.txid).map_err(|e| TaprootError::InvalidTxid(e.to_string()))?;
        let outpoint = OutPoint::new(prev_txid, utxo.vout);
        let input = build_input(outpoint, None);
        inputs.push(input);

        let amount = Amount::from_sat(utxo.value);
        total_amount += amount;

        let prevout = TxOut {
            value: amount,
            script_pubkey: htlc_address.script_pubkey(),
        };
        prevouts.push(prevout);
    }

    let input_count = inputs.len();
    let output_count = 1;

    // 5️⃣ Estimate fees
    let witness_size_per_input = 1 + 65 + 33 + 81 + 34;
    let fee = estimate_htlc_fee(
        input_count,
        output_count,
        witness_size_per_input,
        fee_rate_per_vb,
    );

    // 6️⃣ Build output
    let output = build_output(total_amount - fee, transfer_to_address);

    // 7️⃣ Build unsigned transaction
    let mut tx = build_transaction(inputs, vec![output]);

    // 8️⃣ Prepare shared data
    let leaf_hash = TapLeafHash::from_script(&redeem_script, LeafVersion::TapScript);
    let preimage_bytes =
        hex::decode(preimage).map_err(|e| TaprootError::InvalidPreimage(e.to_string()))?;

    // 🔄 Sign each input individually and assign witness
    for i in 0..tx.input.len() {
        let msg = compute_taproot_sighash(&tx, i, &prevouts, leaf_hash, TapSighashType::Default)
            .map_err(|e| TaprootError::SighashError {
                index: i,
                error: e.to_string(),
            })?;

        let signature = sign_schnorr(&secp, &msg, &keypair);

        let mut witness = Witness::new();
        witness.push(signature.as_ref());
        witness.push(preimage_bytes.clone());
        witness.push(redeem_script.to_bytes());
        witness.push(&control_block.serialize());

        tx.input[i].witness = witness;
    }

    info!("Redeemed transaction: {:?}", tx);
    Ok(tx)
}

pub fn refund_taproot_htlc(
    bitcoin: &Bitcoin,
    sender_private_key: &str,
    utxos: Vec<Utxo>,
    refund_to_address: &Address,
    fee_rate_per_vb: u64,
    network: KnownHrp,
) -> Result<Transaction, TaprootError> {
    let secp = Secp256k1::new();
    info!("Starting P2TR refund for bitcoin: {:?}", bitcoin);

    // 1️⃣ Generate Taproot spend info
    let (htlc_address, spend_info) = generate_p2tr_address(bitcoin, network)?;

    // 2️⃣ Get refund script and control block
    let refund_script = p2tr2_refund_script(bitcoin.timelock, &bitcoin.initiator_pubkey)?;
    let script_ver = (refund_script.clone(), LeafVersion::TapScript);

    let control_block = spend_info
        .control_block(&script_ver)
        .ok_or(TaprootError::ControlBlockError)?;

    // 3️⃣ Derive sender's keypair
    let keypair = derive_keypair(sender_private_key)
        .map_err(|e| TaprootError::InvalidPrivateKey(e.to_string()))?;

    // 4️⃣ Prepare inputs, prevouts, total amount
    let mut inputs = Vec::new();
    let mut prevouts = Vec::new();
    let mut total_amount = Amount::from_sat(0);

    for utxo in utxos.iter() {
        let prev_txid =
            Txid::from_str(&utxo.txid).map_err(|e| TaprootError::InvalidTxid(e.to_string()))?;
        let outpoint = OutPoint::new(prev_txid, utxo.vout);
        let input = build_input(outpoint, Some(bitcoin.timelock as u32)); // locktime for refund
        inputs.push(input);

        let input_amount = Amount::from_sat(utxo.value);
        let prevout = TxOut {
            value: input_amount,
            script_pubkey: htlc_address.script_pubkey(),
        };

        total_amount += input_amount;
        prevouts.push(prevout);
    }

    let input_count = inputs.len();
    let output_count = 1;

    // 5️⃣ Estimate fee based on transaction weight
    let witness_size_per_input = 1 + 65 + 81 + 34; // Sig + Script + ControlBlock
    let fee_amount = estimate_htlc_fee(
        input_count,
        output_count,
        witness_size_per_input,
        fee_rate_per_vb,
    );

    // 6️⃣ Build output
    let output = build_output(total_amount - fee_amount, refund_to_address);

    // 7️⃣ Build transaction
    let mut tx = build_transaction(inputs, vec![output]);

    // 8️⃣ Compute Taproot sighash
    let leaf_hash = TapLeafHash::from_script(&refund_script, LeafVersion::TapScript);

    for i in 0..tx.input.len() {
        let msg = compute_taproot_sighash(&tx, i, &prevouts, leaf_hash, TapSighashType::Default)
            .map_err(|e| TaprootError::SighashError {
                index: i,
                error: e.to_string(),
            })?;

        let signature = sign_schnorr(&secp, &msg, &keypair);

        // 🔟 Build witness stack (Sig | RefundScript | ControlBlock)
        let mut witness = Witness::new();
        witness.push(signature.as_ref());
        witness.push(refund_script.as_bytes());
        witness.push(&control_block.serialize());

        tx.input[i].witness = witness;
    }

    info!("Refunded transaction: {:?}", tx);
    Ok(tx)
}

pub fn instant_refund_taproot_htlc(
    bitcoin: &Bitcoin,
    initiator_private_key: &str,
    redeemer_private_key: &str,
    utxos: Vec<Utxo>,
    refund_to_address: &Address,
    fee_rate_per_vb: u64,
    network: KnownHrp,
) -> Result<Transaction, TaprootError> {
    let secp = Secp256k1::new();
    info!("Starting P2TR instant refund for bitcoin: {:?}", bitcoin);

    // 1️⃣ Generate Taproot spend info
    let (htlc_address, spend_info) = generate_p2tr_address(bitcoin, network)?;

    // 2️⃣ Get instant refund script and control block
    let instant_refund_script = p2tr2_instant_refund_script(&bitcoin.initiator_pubkey, &bitcoin.responder_pubkey)?;
    let script_ver = (instant_refund_script.clone(), LeafVersion::TapScript);

    let control_block = spend_info
        .control_block(&script_ver)
        .ok_or(TaprootError::ControlBlockError)?;

    // 3️⃣ Derive keypairs for both parties
    let initiator_keypair = derive_keypair(initiator_private_key)
        .map_err(|e| TaprootError::InvalidPrivateKey(e.to_string()))?;
    let redeemer_keypair = derive_keypair(redeemer_private_key)
        .map_err(|e| TaprootError::InvalidPrivateKey(e.to_string()))?;

    // 4️⃣ Prepare inputs, prevouts, total amount
    let mut inputs = Vec::new();
    let mut prevouts = Vec::new();
    let mut total_amount = Amount::from_sat(0);

    for utxo in utxos.iter() {
        let prev_txid =
            Txid::from_str(&utxo.txid).map_err(|e| TaprootError::InvalidTxid(e.to_string()))?;
        let outpoint = OutPoint::new(prev_txid, utxo.vout);
        let input = build_input(outpoint, None); // No locktime for instant refund
        inputs.push(input);

        let input_amount = Amount::from_sat(utxo.value);
        let prevout = TxOut {
            value: input_amount,
            script_pubkey: htlc_address.script_pubkey(),
        };

        total_amount += input_amount;
        prevouts.push(prevout);
    }

    let input_count = inputs.len();
    let output_count = 1;

    // 5️⃣ Estimate fee based on transaction weight
    let witness_size_per_input = 1 + 65 + 65 + 81 + 34; // Sig1 + Sig2 + Script + ControlBlock
    let fee_amount = estimate_htlc_fee(
        input_count,
        output_count,
        witness_size_per_input,
        fee_rate_per_vb,
    );

    // 6️⃣ Build output
    let output = build_output(total_amount - fee_amount, refund_to_address);

    // 7️⃣ Build transaction
    let mut tx = build_transaction(inputs, vec![output]);

    // 8️⃣ Compute Taproot sighash
    let leaf_hash = TapLeafHash::from_script(&instant_refund_script, LeafVersion::TapScript);

    for i in 0..tx.input.len() {
        let msg = compute_taproot_sighash(&tx, i, &prevouts, leaf_hash, TapSighashType::Default)
            .map_err(|e| TaprootError::SighashError {
                index: i,
                error: e.to_string(),
            })?;

        // For instant refund, both parties sign the same message
        // The script will verify both signatures and require both to be valid
        let initiator_signature = sign_schnorr(&secp, &msg, &initiator_keypair);
        let redeemer_signature = sign_schnorr(&secp, &msg, &redeemer_keypair);

        // 🔟 Build witness stack (Sig1 | Sig2 | InstantRefundScript | ControlBlock)
        // For the script: <initiator_pubkey> OP_CHECKSIG <redeemer_pubkey> OP_CHECKSIGADD OP_2 OP_NUMEQUAL
        // The witness stack should be: [redeemer_sig, initiator_sig, script, control_block]
        // because the stack is LIFO (Last In, First Out)
        let mut witness = Witness::new();
        witness.push(redeemer_signature.as_ref());
        witness.push(initiator_signature.as_ref());
        witness.push(instant_refund_script.as_bytes());
        witness.push(&control_block.serialize());

        tx.input[i].witness = witness;
    }

    info!("Instant refunded transaction: {:?}", tx);
    Ok(tx)
}

fn get_spending_info(bitcoin: &Bitcoin) -> Result<TaprootSpendInfo, TaprootError> {
    if bitcoin.htlc_type != HTLCType::P2tr2 {
        return Err(TaprootError::InvalidHtlcType(format!(
            "{:?}",
            bitcoin.htlc_type
        )));
    }

    // Validate timelock
    if bitcoin.timelock == 0 {
        return Err(TaprootError::InvalidTimelock);
    }

    // Create redeem script: OP_SHA256 <hash> OP_EQUALVERIFY <responder_pubkey> OP_CHECKSIG
    let redeem_script = p2tr2_redeem_script(&bitcoin.payment_hash, &bitcoin.responder_pubkey)?;

    // Create refund script: <timelock> OP_CSV OP_DROP <initiator_pubkey> OP_CHECKSIG
    let refund_script = p2tr2_refund_script(bitcoin.timelock, &bitcoin.initiator_pubkey)?;

    // Create instant refund script: <initiator_pubkey> OP_CHECKSIG <redeemer_pubkey> OP_CHECKSIGADD OP_2 OP_NUMEQUAL
    let instant_refund_script = p2tr2_instant_refund_script(&bitcoin.initiator_pubkey, &bitcoin.responder_pubkey)?;

    // Use a NUMS point as the internal key
    let internal_key = XOnlyPublicKey::from_str(NUMS_POINT)
        .map_err(|e| TaprootError::InvalidNumsPoint(e.to_string()))?;

    // Build Taproot script tree with redeem, refund, and instant refund paths
    let taproot_builder = TaprootBuilder::new()
        .add_leaf(1, redeem_script)?
        .add_leaf(2, refund_script)?
        .add_leaf(2, instant_refund_script)?;

    let secp = Secp256k1::new();
    let taproot_spend_info = taproot_builder
        .finalize(&secp, internal_key)
        .map_err(|_| TaprootError::TaprootBuildError)?;

    Ok(taproot_spend_info)
}

fn p2tr2_redeem_script(
    payment_hash: &String,
    responder_pubkey: &String,
) -> Result<ScriptBuf, TaprootError> {
    let payment_hash_bytes =
        hex::decode(payment_hash).map_err(|e| TaprootError::InvalidPaymentHash(e.to_string()))?;
    let paymenthash_buf = PushBytesBuf::try_from(payment_hash_bytes)
        .map_err(|e| TaprootError::PushBytesBufError(e.to_string()))?;
    let responder_pubkey = XOnlyPublicKey::from_str(responder_pubkey)
        .map_err(|e| TaprootError::InvalidResponderPubkey(e.to_string()))?;

    let redeem_script = ScriptBuf::builder()
        .push_opcode(opcodes::all::OP_SHA256)
        .push_slice(paymenthash_buf)
        .push_opcode(opcodes::all::OP_EQUALVERIFY)
        .push_x_only_key(&responder_pubkey)
        .push_opcode(opcodes::all::OP_CHECKSIG)
        .into_script();

    Ok(redeem_script)
}

fn p2tr2_refund_script(
    timelock: u64,
    initiator_pubkey: &String,
) -> Result<ScriptBuf, TaprootError> {
    let initiator_pubkey = XOnlyPublicKey::from_str(initiator_pubkey)
        .map_err(|e| TaprootError::InvalidInitiatorPubkey(e.to_string()))?;
    let redeem_script = ScriptBuf::builder()
        .push_int(timelock as i64)
        .push_opcode(opcodes::all::OP_CSV)
        .push_opcode(opcodes::all::OP_DROP)
        .push_x_only_key(&initiator_pubkey)
        .push_opcode(opcodes::all::OP_CHECKSIG)
        .into_script();
    Ok(redeem_script)
}

fn p2tr2_instant_refund_script(
    initiator_pubkey: &String,
    redeemer_pubkey: &String,
) -> Result<ScriptBuf, TaprootError> {
    let initiator_pubkey = XOnlyPublicKey::from_str(initiator_pubkey)
        .map_err(|e| TaprootError::InvalidInitiatorPubkey(e.to_string()))?;
    let redeemer_pubkey = XOnlyPublicKey::from_str(redeemer_pubkey)
        .map_err(|e| TaprootError::InvalidResponderPubkey(e.to_string()))?;
    
    let instant_refund_script = ScriptBuf::builder()
        .push_x_only_key(&initiator_pubkey)
        .push_opcode(opcodes::all::OP_CHECKSIG)
        .push_x_only_key(&redeemer_pubkey)
        .push_opcode(opcodes::all::OP_CHECKSIGADD)
        .push_int(2)
        .push_opcode(opcodes::all::OP_NUMEQUAL)
        .into_script();
    Ok(instant_refund_script)
}

fn estimate_htlc_fee(
    input_count: usize,
    output_count: usize,
    witness_size_per_input: usize,
    fee_rate_per_vb: u64,
) -> Amount {
    let base_size = 6 + (input_count * 40) + 1 + (output_count * 43) + 4;
    let total_witness_size = input_count * witness_size_per_input;
    let total_weight = base_size * 4 + total_witness_size;
    let vsize = (total_weight + 3) / 4;
    Amount::from_sat(vsize as u64 * fee_rate_per_vb)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::UtxoStatus;
    use env_logger;
    use bitcoin::{block, network, Network};

    // Global constant for the test address
    const TEST_EXPECTED_ADDRESS: &str =
        "tb1px4qe74pc66rklv2pvk59xszsfff6xnkuluhzt3te23hdgaawtuqque804v";

    // Helper to initialize logger
    fn init_logger() {
        let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
            .try_init();
    }

    // test private key 1 = "efb5934870204113017bf304e6c6068c19779a914bfa9fc46b125c869ab8c417"
    // test public key 1 = "9f7f57213f8896d77d66f418a6ab923e4fd08868860eda5d99ce9d71e2e55b54"
    // test private key 2 = "0a913b5d813cfe9e01f7407693d2b55528b0d6d947e8bc7a93fbbdc3bf37befd"
    // test public key 2 = "c23df7a936dd357657c5eed9b3a9130430407e3bb2e93119c976f01420447139"
    //secret = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    //secret hash = "359397539cc67687fa779c133c4da0cc60097dfef9e63b5ccf08eca0fca05530"

    // Helper to create a mock Bitcoin struct
    fn create_mock_bitcoin() -> Bitcoin {
        Bitcoin {
            initiator_pubkey:
                "456db773aa5c4cc6ed3a4780243d16bd58220be318702603b219fe79eceb848f".to_string(),
            responder_pubkey:
                "f1946d446157bc98699db7271d2fe9495ea4bcf25eb81b645c89803e18af9a22".to_string(),
            timelock: 144,
            amount: 10000,
            htlc_type: HTLCType::P2tr2,
            payment_hash: "1572a86fb4b1f15623da10e34034fd151090d37e6f0f3ef4f69926f7f3388b78".to_string(),
        }
    }
    fn create_mock_utxo(block_height: u32, txid: &str, vout: u32, value: u64) -> Utxo {
        Utxo {
            txid: txid.to_string(),
            vout,
            value,
            status: UtxoStatus {
                confirmed: true,
                block_height: block_height,
                block_hash: "0000000000000000000000000000000000000000000000000000000000000000"
                    .to_string(),
                block_time: 1234567890,
            },
        }
    }

    #[test]
    fn test_generate_p2tr_address_success() {
        init_logger();
        let bitcoin = create_mock_bitcoin();
        let network = KnownHrp::Testnets;

        let result = generate_p2tr_address(&bitcoin, network);
        assert!(result.is_ok(), "Expected Ok, got {:?}", result);
        let (address, spend_info) = result.unwrap();
        assert_eq!(address.to_string(), TEST_EXPECTED_ADDRESS);
        assert_eq!(
            spend_info.internal_key().to_string(),
            NUMS_POINT,
            "Unexpected internal key"
        );
    }

    #[test]
    fn test_generate_p2tr_address_invalid_timelock() {
        init_logger();
        let mut bitcoin = create_mock_bitcoin();
        bitcoin.timelock = 1;
        let network = KnownHrp::Testnets;

        let result = generate_p2tr_address(&bitcoin, network);
        assert!(result.is_ok(), "Expected Ok, got {:?}", result);
        let (address, spend_info) = result.unwrap();
        assert_ne!(address.to_string(), TEST_EXPECTED_ADDRESS);
        assert_eq!(
            spend_info.internal_key().to_string(),
            NUMS_POINT,
            "Unexpected internal key"
        );
    }

    #[test]
    fn test_generate_p2tr_address_invalid_payment_hash() {
        init_logger();
        let mut bitcoin = create_mock_bitcoin();
        bitcoin.payment_hash =
            "f86d2c86752e0be975d9c2256b49bd8ac29d8c227c406c42d04a5e7fa4162f9b".to_string();
        let network = KnownHrp::Testnets;

        let result = generate_p2tr_address(&bitcoin, network);
        assert!(result.is_ok(), "Expected Ok, got {:?}", result);
        let (address, spend_info) = result.unwrap();
        assert_ne!(address.to_string(), TEST_EXPECTED_ADDRESS);
        assert_eq!(
            spend_info.internal_key().to_string(),
            NUMS_POINT,
            "Unexpected internal key"
        );
    }

    #[test]
    fn test_generate_p2tr_address_invalid_responder_pubkey() {
        init_logger();
        let mut bitcoin = create_mock_bitcoin();
        bitcoin.responder_pubkey = "invalid_pubkey".to_string();
        let network = KnownHrp::Testnets;

        let result = generate_p2tr_address(&bitcoin, network);
        assert!(result.is_err(), "Expected error, got Ok: {:?}", result);
        assert!(matches!(
            result,
            Err(TaprootError::InvalidResponderPubkey(_))
        ));

        bitcoin.responder_pubkey =
            "dff4bf971c44f04124009fa70f1b49d1c6aec419d8879410dd0613ad400da867".to_string();
        let result = generate_p2tr_address(&bitcoin, network);
        assert!(result.is_ok(), "Expected Ok, got {:?}", result);
        let (address, spend_info) = result.unwrap();
        assert_ne!(address.to_string(), TEST_EXPECTED_ADDRESS);
    }

    #[test]
    fn test_redeem_taproot_htlc_success() {
        init_logger();
        let bitcoin = create_mock_bitcoin();
        let preimage = "e235db8c009db64dcd2b6ab8295afc024f46c23c24e1dde0e984fd08cdb47a91";
        let private_key = "250bd3a0f83f249fcb9298b1a89458453f8b6301c3076d6f48f22a25d40899d3";

        let network = KnownHrp::Testnets;
        let htlc_address = generate_p2tr_address(&bitcoin, network);
        assert!(htlc_address.is_ok(), "Expected Ok, got {:?}", htlc_address);
        let htlc_address = htlc_address.unwrap().0;

        let transfer_to_address = Address::from_str("tb1qleejf8n05j660f74q69pwhvyg8n620xz8r60h2")
            .unwrap()
            .assume_checked();

        let utxo = create_mock_utxo(
            2315994,
            "9c8a5fc42f8f57537f3a2746be78632f6ff2f0bb65a87c196496db50970c5787",
            0,
            1000,
        );
        let utxos = vec![utxo];
        let fee_rate_per_vb = 3;
        let result = redeem_taproot_htlc(
            &bitcoin,
            preimage,
            private_key,
            utxos,
            &transfer_to_address,
            fee_rate_per_vb,
            network,
        );

        let tx = result.expect("Expected Ok, got Err");

        let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);
        info!("Redeemed transaction hex: {}", tx_hex);

        assert_eq!(tx_hex, "0200000000010187570c9750db9664197ca865bbf0f26f2f6378be46273a7f53578f2fc45f8a9c0000000000fdffffff012c02000000000000160014fe73249e6fa4b5a7a7d5068a175d8441e7a53cc204405eb6ac42bf177116842b8be145892420f46f3d57f456d3e1906797165a1a347370553b20fea6131bf99b9d250c503bb69f192544eccb93bfec53e9e308d569bd20e235db8c009db64dcd2b6ab8295afc024f46c23c24e1dde0e984fd08cdb47a9145a8201572a86fb4b1f15623da10e34034fd151090d37e6f0f3ef4f69926f7f3388b788820f1946d446157bc98699db7271d2fe9495ea4bcf25eb81b645c89803e18af9a22ac41c150929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0abd07cb2de3b9cf682858acc9bd1a7ba39cfc7019a115c5713a445b7e2df1bed00000000");
    }

    #[test]
    fn test_refund_taproot_htlc_success() {
        init_logger();
        let mut bitcoin = create_mock_bitcoin();
        bitcoin.payment_hash =
            "f1f77ae8427dd38431b876f7d7aba1504aa29546d55c1304e7096d9829eb0c79".to_string();
        bitcoin.timelock = 5;
        let private_key = "c929c768be0902d5bb7ae6e38bdc6b3b24cefbe93650da91975756a09e408460";
        let network = KnownHrp::Testnets;
        let htlc_address = generate_p2tr_address(&bitcoin, network);
        
        assert!(htlc_address.is_ok(), "Expected Ok, got {:?}", htlc_address);
        
        let htlc_address = htlc_address.unwrap().0;
        println!("htlc_address: {:?}", htlc_address);

        let utxo = create_mock_utxo(
            2315994,
            "1a52ad2f0dbb56eb4a098a34b1e40c5931de8e6e59bf3c86a672269a8bd99730",
            1,
            1000,
        );
        let utxos = vec![utxo];
        let fee_rate_per_vb = 3;

        let refund_to_address = Address::from_str("tb1qw00nzjpepd3kvq384vezwxqhmedhm578x3mxjv")
            .unwrap()
            .assume_checked();

        let result = refund_taproot_htlc(
            &bitcoin,
            private_key,
            utxos,
            &refund_to_address,
            fee_rate_per_vb,
            network,
        );

        let tx = result.expect("Expected Ok, got Err");
        let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);
        info!("Refunded transaction hex: {}", tx_hex);
        assert_eq!(tx_hex, "020000000001013097d98b9a2672a6863cbf596e8ede31590ce4b1348a094aeb56bb0d2fad521a01000000000500000001440200000000000016001473df3148390b63660227ab32271817de5b7dd3c70340b382ee37b34cd761246cf3a00e4a1c2f0a4f97b5cdad50b44cb75ff402481b525a46ff76c1cfc4862ef2974f07b47384b37cefac3515987170ed74699c7a38c42555b27520456db773aa5c4cc6ed3a4780243d16bd58220be318702603b219fe79eceb848fac61c050929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0996e4eeb087e3ecb331d3c6771a4d126425b4ae2de777da104b3ef48f6a42d6716b236af874ac1ece9031f1bba2ee49d04c7762a31a9058c0b42ec164b3cdb0b00000000");
    }

    #[test]
    fn test_instant_refund_taproot_htlc_success() {
        init_logger();
        let bitcoin = create_mock_bitcoin();
        let initiator_private_key = "c929c768be0902d5bb7ae6e38bdc6b3b24cefbe93650da91975756a09e408460";
        let redeemer_private_key = "250bd3a0f83f249fcb9298b1a89458453f8b6301c3076d6f48f22a25d40899d3";
        let network = KnownHrp::Testnets;
        
        let htlc_address = generate_p2tr_address(&bitcoin, network);
        assert!(htlc_address.is_ok(), "Expected Ok, got {:?}", htlc_address);
        let htlc_address = htlc_address.unwrap().0;
        println!("htlc_address: {:?}", htlc_address);

        let utxo = create_mock_utxo(
            2315994,
            "3a10f076b76e0a0abd13d182ba586ff03fec4d1739c97b6ecac6d4797a8e140d",
            1,
            1000,
        );
        let utxos = vec![utxo];
        let fee_rate_per_vb = 3;

        let refund_to_address = Address::from_str("tb1qw00nzjpepd3kvq384vezwxqhmedhm578x3mxjv")
            .unwrap()
            .assume_checked();

        let result = instant_refund_taproot_htlc(
            &bitcoin,
            initiator_private_key,
            redeemer_private_key,
            utxos,
            &refund_to_address,
            fee_rate_per_vb,
            network,
        );

        let tx = result.expect("Expected Ok, got Err");
        let tx_hex = bitcoin::consensus::encode::serialize_hex(&tx);
        info!("Instant refunded transaction hex: {}", tx_hex);
        
        // This assertion will fail initially - you can check the actual hex and update it
        assert_eq!(tx_hex, "020000000001010d148e7a79d4c6ca6e7bc939174dec3ff06f58ba82d113bd0a0a6eb776f0103a0100000000fdffffff01140200000000000016001473df3148390b63660227ab32271817de5b7dd3c70440ca652f9bcf2117247560ebd844ec7cf54d486c277b38a60e2588c86a046400bf1996ded703335b537bad9804d237b9e44afed156f24b17bb58cbb2e0b8aaaef540699bcfada2a1dc2034ea8aae22ba3a1d94b4c12a8185e4a2a370dcdbe558d627ca48a8aa18e6a3e2c8ad4621a265f8cb4d966005f176b820a19e0a12c3b76d324620456db773aa5c4cc6ed3a4780243d16bd58220be318702603b219fe79eceb848fac20f1946d446157bc98699db7271d2fe9495ea4bcf25eb81b645c89803e18af9a22ba529c61c150929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac08bd3558f72df00e0350f75b5db3777bd641a70fca04d9a8e5a25b4817efb582601ed499969d019d7f597821eba522895c0642f44d7f1dd0b65184fac1f4cce3b00000000");
    }
}