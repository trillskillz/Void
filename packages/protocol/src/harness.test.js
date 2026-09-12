import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  harnessConfigFromEnv,
  planHarnessExec,
  processJournal,
  parseHarnessStdout,
  chainMetaFromLockResult,
  ACTION_TO_SCRIPT,
} from "./harness.js";
import { createKsbStubBackend } from "./covenant.js";
import { createSimulator } from "./simulator.js";

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
  assert.equal(lock.env.DRY_RUN, "1");
});

test("parseHarnessStdout reads lock-bond dry-run json", () => {
  const sample = JSON.stringify({
    ok: true,
    mode: "dry-run",
    covenantAddress: "kaspatest:qqexample",
    finalTransactionId: "abc123txid",
  });
  const meta = chainMetaFromLockResult(parseHarnessStdout(sample));
  assert.equal(meta.lockTxid, "abc123txid");
  assert.equal(meta.covenantAddress, "kaspatest:qqexample");
  assert.equal(meta.lockMode, "dry-run");
});

test("recordChainLock persists on simulator job", () => {
  const sim = createSimulator();
  const job = sim.openJob({ poster: "p", escrowAmount: 1, bondAmount: 1, verifierId: "v" });
  sim.claim(job.jobId, "w");
  const updated = sim.recordChainLock(job.jobId, {
    lockTxid: "txid1",
    lockVout: 0,
    covenantAddress: "kaspatest:q",
    lockMode: "dry-run",
  });
  assert.equal(updated.chain.lockTxid, "txid1");
});

test("processJournal lock spawn writes chain meta onto job", async () => {
  const root = join(tmpdir(), `fake-kasbonds-${Date.now()}`);
  const scripts = join(root, "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(
    join(scripts, "lock-bond.mjs"),
    `console.log(JSON.stringify({ok:true,mode:"dry-run",covenantAddress:"kaspatest:covenant",finalTransactionId:"locktxid999"}))\n`
  );
  writeFileSync(join(scripts, "release-proof.mjs"), `console.log(JSON.stringify({ok:true}))\n`);
  writeFileSync(join(scripts, "slash-proof.mjs"), `console.log(JSON.stringify({ok:true}))\n`);

  try {
    const backend = createKsbStubBackend();
    const job = backend.openJob({
      poster: "p",
      escrowAmount: 10,
      bondAmount: 1,
      verifierId: "oracle:ksb",
    });
    backend.claim(job.jobId, "w");
    const lockEntry = backend.journal().find((e) => e.action === "lock_bond");

    const results = await processJournal([lockEntry], {
      env: { BONDED_WORK_CHAIN: "1", KASBONDS_ROOT: root },
      execute: true,
      backend,
    });

    assert.equal(results[0].status, "ok");
    assert.equal(results[0].wroteChain, true);
    const loaded = backend.get(job.jobId);
    assert.equal(loaded.chain.lockTxid, "locktxid999");
    assert.equal(loaded.chain.covenantAddress, "kaspatest:covenant");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("release plan picks up persisted lock txid", async () => {
  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "p",
    escrowAmount: 10,
    bondAmount: 1,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "w");
  backend.recordChainLock(job.jobId, {
    lockTxid: "persisted-txid",
    lockVout: 0,
    covenantAddress: "kaspatest:c",
    lockMode: "dry-run",
  });
  backend.submit(job.jobId, "w", { contentHash: "sha256:x" });
  backend.attest(job.jobId, "oracle:ksb", "pass");
  const release = backend.journal().find((e) => e.action === "release");
  const plan = planHarnessExec(
    { ...release, chain: backend.get(job.jobId).chain },
    { enabled: true, dryRun: true, kasbondsRoot: "/tmp/fake-kasbonds" },
    {}
  );
  assert.equal(plan.env.BOND_LOCK_TXID, "persisted-txid");
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

  const results = await processJournal(backend.journal(), { env: {}, execute: true });
  assert.ok(results.some((r) => r.wouldRun === "lock-bond.mjs"));
});
