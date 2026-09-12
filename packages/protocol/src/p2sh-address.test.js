import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hexToBytes,
  networkIdFromOpenSilver,
  deriveP2shAddress,
  candidateKaspaWasmPaths,
} from "./p2sh-address.js";

test("networkId strips kaspa: prefix", () => {
  assert.equal(networkIdFromOpenSilver("kaspa:testnet-12"), "testnet-12");
  assert.equal(networkIdFromOpenSilver("testnet-12"), "testnet-12");
});

test("hexToBytes round-trips even hex", () => {
  assert.deepEqual([...hexToBytes("0a0b")], [10, 11]);
});

test("injected deriver wins", async () => {
  const r = await deriveP2shAddress("00ff", "kaspa:testnet-12", {
    deriver: (bytes, net) => {
      assert.equal(bytes.length, 2);
      assert.equal(net, "testnet-12");
      return "kaspatest:qderived";
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.address, "kaspatest:qderived");
});

test("missing wasm reports reason", async () => {
  const r = await deriveP2shAddress("00", "kaspa:testnet-12", {
    env: {},
    kaspaWasmPath: "/tmp/definitely-missing-kaspa.js",
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /kaspa-wasm not found/);
});

test("candidate paths include KASBONDS_ROOT vendor", () => {
  const paths = candidateKaspaWasmPaths({ KASBONDS_ROOT: "/tmp/KasBonds" });
  assert.ok(paths.some((p) => p.includes("vendor/x402-KAS/packages/kaspa-wasm/kaspa.js")));
});
