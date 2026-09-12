import { test } from "node:test";
import assert from "node:assert/strict";
import {
  harnessConfigFromEnv,
  planHarnessExec,
  processJournal,
  ACTION_TO_SCRIPT,
} from "./harness.js";
import { createKsbStubBackend } from "./covenant.js";

test("disarmed by default", () => {
  const cfg = harnessConfigFromEnv({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.dryRun, true);
});

test("live requires explicit flag", () => {
  const cfg = harnessConfigFromEnv({ BONDED_WORK_CHAIN: "1", BONDED_WORK_CHAIN_LIVE: "1" });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.dryRun, false);
});

test("plans lock/release/slash scripts", () => {
  const cfg = {
    enabled: true,
    live: false,
    dryRun: true,
    kasbondsRoot: "/tmp/KasBonds",
  };
  const lock = planHarnessExec({ action: "lock_bond", jobId: "j1" }, cfg, {});
  assert.equal(lock.skipped, false);
  assert.equal(lock.scriptName, ACTION_TO_SCRIPT.lock_bond);
  assert.equal(lock.dryRun, true);
  assert.equal(lock.env.DRY_RUN, "1");
});

test("processJournal plans without executing when disarmed", async () => {
  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "p",
    escrowAmount: 10,
    bondAmount: 1,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "w");
  backend.submit(job.jobId, "w", { contentHash: "sha256:x" });
  backend.attest(job.jobId, "oracle:ksb", "pass");

  const results = await processJournal(backend.journal(), {
    env: {},
    execute: true, // even with execute, disarmed → skipped
  });
  const chainish = results.filter((r) => r.wouldRun || r.scriptName);
  assert.ok(chainish.every((r) => r.skipped || r.status === "skipped"));
  assert.ok(results.some((r) => r.wouldRun === "lock-bond.mjs"));
  assert.ok(results.some((r) => r.wouldRun === "release-proof.mjs"));
});
