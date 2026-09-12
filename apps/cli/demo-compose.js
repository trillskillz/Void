/**
 * Compose both covenant legs on one job:
 *   1) OpenSilver deploy-plan → job.chain.escrow (+ escrowAddress when wasm available)
 *   2) KasBonds lock-bond dry-run → job.chain.lockTxid / covenantAddress
 *
 * Dry-run only unless BONDED_WORK_CHAIN_LIVE=1 (never set that casually).
 *
 * Required for full execute:
 *   OPENSILVER_ROOT, BONDED_WORK_OPENSILVER=1
 *   KASBONDS_ROOT, BONDED_WORK_CHAIN=1
 *   (optional) KASPA_WASM_PATH — else kaspa-wasm from KASBONDS_ROOT vendor
 */
import { mkdirSync } from "node:fs";
import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { processEscrowDeploy, opensilverConfigFromEnv } from "../../packages/protocol/src/opensilver.js";
import { processJournal, harnessConfigFromEnv } from "../../packages/protocol/src/harness.js";

const env = process.env;
const osCfg = opensilverConfigFromEnv(env);
const chainCfg = harnessConfigFromEnv(env);

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");

console.log("job", job.jobId);
console.log("opensilver", { enabled: osCfg.enabled, root: osCfg.opensilverRoot });
console.log("kasbonds", { enabled: chainCfg.enabled, root: chainCfg.kasbondsRoot, dryRun: chainCfg.dryRun });

// --- escrow leg ---
const planned = await processEscrowDeploy(client.get(job.jobId), {
  execute: false,
  backend: client.backend,
  env,
});
console.log("escrow plan:", planned.command);

if (osCfg.enabled && osCfg.opensilverRoot) {
  mkdirSync(osCfg.outDir || "./data/opensilver-plans", { recursive: true });
  const escrow = await processEscrowDeploy(client.get(job.jobId), {
    execute: true,
    backend: client.backend,
    env,
  });
  console.log(
    "escrow",
    escrow.status,
    escrow.wroteEscrow ? "wroteEscrow" : "",
    escrow.escrowAddress || escrow.addressDerive?.reason || ""
  );
} else {
  console.log("escrow skipped (set BONDED_WORK_OPENSILVER=1 and OPENSILVER_ROOT)");
}

// --- bond leg ---
const lockEntry = client.journal().find((e) => e.action === "lock_bond");
if (chainCfg.enabled && chainCfg.kasbondsRoot) {
  const lockResults = await processJournal([lockEntry], {
    env,
    execute: true,
    backend: client.backend,
  });
  const lock = lockResults[0];
  console.log("lock", lock.status, lock.wroteChain ? "wroteChain" : "", client.get(job.jobId).chain?.lockTxid || lock.reason || "");
} else {
  console.log("lock skipped (set BONDED_WORK_CHAIN=1 and KASBONDS_ROOT)");
  const plannedLock = await processJournal([lockEntry], { env, execute: false });
  console.log("lock plan:", plannedLock[0]?.scriptName || plannedLock[0]?.wouldRun || plannedLock[0]?.reason);
}

const chain = client.get(job.jobId).chain;
console.log("job.chain", JSON.stringify(chain, null, 2));

const okEscrow = !osCfg.enabled || Boolean(chain?.escrow?.patternId);
const okLock = !chainCfg.enabled || Boolean(chain?.lockTxid);
if (!okEscrow || !okLock) {
  process.exitCode = 1;
}
