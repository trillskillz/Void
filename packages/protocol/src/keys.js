/**
 * Key material helpers for Bonded Work ↔ OpenSilver ctors / KasBonds env.
 * Generates real secp256k1 keypairs; arbiter slot uses blake2b-256(pubkey_bytes).
 */

import { generateKeyPairSync, createPublicKey, createPrivateKey } from "node:crypto";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

function derSpkiToCompressedSecp256k1(spkiDer) {
  // SPKI for uncompressed secp256k1 ends with 0x04 || X(32) || Y(32)
  const raw = spkiDer.subarray(spkiDer.length - 65);
  if (raw[0] !== 0x04 || raw.length !== 65) {
    throw new Error("unexpected secp256k1 SPKI public key encoding");
  }
  const x = raw.subarray(1, 33);
  const y = raw.subarray(33, 65);
  const prefix = (y[y.length - 1] & 1) === 0 ? 0x02 : 0x03;
  const out = new Uint8Array(33);
  out[0] = prefix;
  out.set(x, 1);
  return out;
}

export function generateSecp256k1Keypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
  const spki = publicKey.export({ type: "spki", format: "der" });
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const compressed = derSpkiToCompressedSecp256k1(spki);
  // last 32 bytes of PKCS8 often hold the raw scalar for this curve export — prefer explicit
  const jwk = privateKey.export({ format: "jwk" });
  const d = Buffer.from(jwk.d, "base64url");
  return {
    privateKeyHex: Buffer.from(d).toString("hex"),
    publicKeyHex: Buffer.from(compressed).toString("hex"),
    publicKeyUncompressedHex: Buffer.from(spki.subarray(spki.length - 65)).toString("hex"),
  };
}

export function blake2b256Hex(bytes) {
  const input = typeof bytes === "string" ? hexToBytes(bytes.replace(/^0x/, "")) : bytes;
  return bytesToHex(blake2b(input, { dkLen: 32 }));
}

export function arbiterHashFromPubkeyHex(pubkeyHex) {
  const hex = pubkeyHex.replace(/^0x/, "");
  return blake2b256Hex(hex);
}

/**
 * Build OpenSilver BilateralEscrow ctor args from key material.
 * @param {{ buyerPubKeyHex: string, sellerPubKeyHex: string, arbiterPubKeyHex: string, timeoutUnix?: number, timeoutSecs?: number }} keys
 */
export function bilateralEscrowCtorArgs(keys) {
  const timeout =
    keys.timeoutUnix ??
    Math.floor(Date.now() / 1000) + (keys.timeoutSecs ?? 14 * 24 * 3600);
  return [
    keys.buyerPubKeyHex.replace(/^0x/, ""),
    keys.sellerPubKeyHex.replace(/^0x/, ""),
    arbiterHashFromPubkeyHex(keys.arbiterPubKeyHex),
    timeout,
  ];
}

export function generateEscrowPartyKeys() {
  const buyer = generateSecp256k1Keypair();
  const seller = generateSecp256k1Keypair();
  const arbiter = generateSecp256k1Keypair();
  const ctorArgs = bilateralEscrowCtorArgs({
    buyerPubKeyHex: buyer.publicKeyHex,
    sellerPubKeyHex: seller.publicKeyHex,
    arbiterPubKeyHex: arbiter.publicKeyHex,
  });
  return {
    buyer,
    seller,
    arbiter,
    ctorArgs,
    warning: "Generated for testnet planning — store private keys securely; never commit them.",
  };
}
