/**
 * Dry-run lock → release through the KasBonds harness.
 *
 * Lock succeeds without funding. Release needs a real covenant UTXO on TN12
 * matching job.chain.lockTxid (dry-run locks do not broadcast).
 */
import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { processJournal } from "../../packages/protocol/src/harness.js";

const env = {
  ...process.env,
  BONDED_WORK_CHAIN: process.env.BONDED_WORK_CHAIN || "1",
  KASBONDS_ROOT: process.env.KASBONDS_ROOT,
};

if (!env.KASBONDS_ROOT) {
  console.error("Set KASBONDS_ROOT to a KasBonds checkout (npm install websocket there).");
  process.exit(2);
}

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");

const lockEntry = client.journal().find((e) => e.action === "lock_bond");
const lockResults = await processJournal([lockEntry], {
  env,
  execute: true,
  backend: client.backend,
});
const lock = lockResults[0];
console.log("lock", lock.status, lock.wroteChain ? "wroteChain" : "", client.get(job.jobId).chain);

client.submit(job.jobId, "agent:worker", { contentHash: "sha256:lifecycle" });
client.attest(job.jobId, "oracle:ksb", "pass");

const releaseEntry = client.journal().find((e) => e.action === "release");
const releaseResults = await processJournal([releaseEntry], {
  env,
  execute: true,
  backend: client.backend,
});
const release = releaseResults[0];
console.log("release", release.status, release.code);
if (release.status !== "ok") {
  const err = (release.stderr || release.stdout || release.reason || "").trim();
  console.log("release detail:", err.slice(-400));
  console.log(
    "note: release needs a funded covenant UTXO for BOND_LOCK_TXID; dry-run lock does not create one. set BONDED_WORK_CHAIN_LIVE=1 only when you mean to broadcast."
  );
  process.exitCode = release.code || 1;
} else {
  console.log("release ok", release.parsed);
}
