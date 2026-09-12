/**
 * Derive a Kaspa P2SH address from a redeem-script hex.
 *
 * Uses kaspa-wasm dynamically — never a hard dependency of the protocol package.
 * Resolution order for the module:
 *   1. opts.kaspa / injected module with payToScriptHashScript + addressFromScriptPublicKey
 *   2. env.KASPA_WASM_PATH (file URL or absolute path to kaspa.js)
 *   3. env.KASBONDS_ROOT/vendor/x402-KAS/packages/kaspa-wasm/kaspa.js
 *   4. opts.kaspaWasmPath
 *
 * OpenSilver's npm `kaspa-wasm` build often lacks these helpers; prefer KasBonds vendor.
 */

import { accessSync, constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function networkIdFromOpenSilver(network) {
  if (!network) return "testnet-12";
  return String(network).replace(/^kaspa:/, "");
}

export function hexToBytes(hex) {
  const h = String(hex).replace(/^0x/i, "").trim();
  if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2 !== 0) {
    throw new Error(`invalid redeem script hex (len=${h.length})`);
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function candidateKaspaWasmPaths(env = process.env, opts = {}) {
  const paths = [];
  if (opts.kaspaWasmPath) paths.push(opts.kaspaWasmPath);
  if (env.KASPA_WASM_PATH) paths.push(env.KASPA_WASM_PATH);
  if (env.KASBONDS_ROOT) {
    paths.push(join(env.KASBONDS_ROOT, "vendor/x402-KAS/packages/kaspa-wasm/kaspa.js"));
  }
  return paths;
}

export async function loadKaspaWasm(env = process.env, opts = {}) {
  if (opts.kaspa) return opts.kaspa;
  for (const p of candidateKaspaWasmPaths(env, opts)) {
    try {
      accessSync(p, fsConstants.R_OK);
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.payToScriptHashScript === "function" && typeof mod.addressFromScriptPublicKey === "function") {
        return mod;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * @returns {{ ok: true, address: string, networkId: string } | { ok: false, reason: string }}
 */
export async function deriveP2shAddress(redeemScriptHex, network, opts = {}) {
  if (!redeemScriptHex) {
    return { ok: false, reason: "missing redeemScriptHex" };
  }
  if (typeof opts.deriver === "function") {
    try {
      const networkId = networkIdFromOpenSilver(network);
      const address = opts.deriver(hexToBytes(redeemScriptHex), networkId);
      if (!address) return { ok: false, reason: "deriver returned empty address" };
      return { ok: true, address: String(address), networkId };
    } catch (err) {
      return { ok: false, reason: `deriver failed: ${err.message}` };
    }
  }

  const kaspa = await loadKaspaWasm(opts.env || process.env, opts);
  if (!kaspa) {
    return {
      ok: false,
      reason:
        "kaspa-wasm not found (set KASBONDS_ROOT or KASPA_WASM_PATH to a build with payToScriptHashScript)",
    };
  }

  try {
    const networkId = networkIdFromOpenSilver(network);
    const scriptBytes = hexToBytes(redeemScriptHex);
    const spk = kaspa.payToScriptHashScript(scriptBytes);
    const address = kaspa.addressFromScriptPublicKey(spk, networkId)?.toString();
    if (!address) return { ok: false, reason: "addressFromScriptPublicKey returned empty" };
    return { ok: true, address, networkId };
  } catch (err) {
    return { ok: false, reason: `kaspa-wasm derive failed: ${err.message}` };
  }
}
