import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersistedSimulator } from "./persisted.js";

test("sqlite persist survives reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bonded-"));
  const dbPath = join(dir, "jobs.sqlite");
  try {
    const a = await createPersistedSimulator({ dbPath });
    const job = a.openJob({
      poster: "agent:poster",
      escrowAmount: 1000,
      bondAmount: 100,
      verifierId: "verifier:v1",
    });
    a.claim(job.jobId, "agent:worker");
    a.close();

    const b = await createPersistedSimulator({ dbPath });
    const loaded = b.get(job.jobId);
    assert.equal(loaded.state, "Locked");
    assert.equal(loaded.worker, "agent:worker");
    b.submit(job.jobId, "agent:worker", { contentHash: "sha256:persist" });
    const done = b.attest(job.jobId, "verifier:v1", "pass");
    assert.equal(done.state, "Released");
    b.close();

    const c = await createPersistedSimulator({ dbPath });
    assert.equal(c.get(job.jobId).state, "Released");
    c.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sqlite + ksb persists chain escrow and lock across reopen", async () => {
  const { createPersistedKsbBackend } = await import("./persisted.js");
  const dir = mkdtempSync(join(tmpdir(), "bonded-ksb-"));
  const dbPath = join(dir, "jobs.sqlite");
  try {
    const a = await createPersistedKsbBackend({ dbPath });
    const job = a.openJob({
      poster: "agent:poster",
      escrowAmount: 1000,
      bondAmount: 100,
      verifierId: "oracle:ksb",
      jobId: "job_chain",
    });
    a.claim(job.jobId, "agent:worker");
    a.recordEscrowPlan(job.jobId, {
      patternId: "core.escrow-bilateral",
      network: "kaspa:testnet-12",
      escrowAddress: "kaspatest:qescrow",
      redeemScriptHex: "00ff",
    });
    a.recordChainLock(job.jobId, {
      lockTxid: "txid-persist",
      lockVout: 0,
      covenantAddress: "kaspatest:qcovenant",
      lockMode: "dry-run",
    });
    assert.ok(a.journal().some((e) => e.action === "lock_bond"));
    a.close();

    const b = await createPersistedKsbBackend({ dbPath });
    const loaded = b.get("job_chain");
    assert.equal(loaded.chain.escrow.escrowAddress, "kaspatest:qescrow");
    assert.equal(loaded.chain.lockTxid, "txid-persist");
    assert.equal(loaded.chain.covenantAddress, "kaspatest:qcovenant");
    assert.ok(b.journal().some((e) => e.action === "lock_bond"));
    b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
