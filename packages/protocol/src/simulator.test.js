import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulator } from "./simulator.js";

test("happy path: open → claim → submit → release", () => {
  const sim = createSimulator();
  const job = sim.openJob({
    poster: "agent:poster",
    escrowAmount: 10_000,
    bondAmount: 1_000,
    verifierId: "verifier:v1",
  });
  assert.equal(job.state, "Open");
  sim.claim(job.jobId, "agent:worker");
  sim.submit(job.jobId, "agent:worker", { contentHash: "sha256:abc", uri: "ipfs://x" });
  const done = sim.attest(job.jobId, "verifier:v1", "pass");
  assert.equal(done.state, "Released");
  assert.equal(done.payouts.protocolFee, 300);
  assert.equal(done.payouts.worker, 9_700);
  assert.equal(done.payouts.posterBondReturn, 1_000);
});

test("fail path: attest fail → slash", () => {
  const sim = createSimulator();
  const job = sim.openJob({
    poster: "agent:poster",
    escrowAmount: 5_000,
    bondAmount: 500,
    verifierId: "verifier:v1",
  });
  sim.claim(job.jobId, "agent:worker");
  sim.submit(job.jobId, "agent:worker", { contentHash: "sha256:bad" });
  const done = sim.attest(job.jobId, "verifier:v1", "fail");
  assert.equal(done.state, "Slashed");
  assert.equal(done.payouts.worker, 0);
  assert.equal(done.payouts.escrowToPoster, 5_000);
  assert.equal(done.payouts.slash, 500);
});
