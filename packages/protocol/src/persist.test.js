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
