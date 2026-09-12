import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateSecp256k1Keypair,
  arbiterHashFromPubkeyHex,
  bilateralEscrowCtorArgs,
  generateEscrowPartyKeys,
} from "./keys.js";

test("secp256k1 compressed pubkey is 33-byte hex", () => {
  const kp = generateSecp256k1Keypair();
  assert.equal(kp.publicKeyHex.length, 66);
  assert.match(kp.publicKeyHex, /^0[23][0-9a-f]{64}$/);
  assert.equal(kp.privateKeyHex.length, 64);
});

test("arbiter hash is 32-byte hex", () => {
  const kp = generateSecp256k1Keypair();
  const h = arbiterHashFromPubkeyHex(kp.publicKeyHex);
  assert.equal(h.length, 64);
});

test("bilateral ctor shape", () => {
  const keys = generateEscrowPartyKeys();
  assert.equal(keys.ctorArgs.length, 4);
  assert.equal(typeof keys.ctorArgs[3], "number");
  assert.equal(keys.ctorArgs[2], arbiterHashFromPubkeyHex(keys.arbiter.publicKeyHex));
});
