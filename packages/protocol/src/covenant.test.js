import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createKsbStubBackend,
  mapBondedStateToKsb,
  recommendOpenSilverPattern,
} from "./covenant.js";

test("state map covers terminal product states", () => {
  assert.equal(mapBondedStateToKsb("Released"), "released");
  assert.equal(mapBondedStateToKsb("Slashed"), "slashed");
  assert.equal(mapBondedStateToKsb("Locked"), "active");
});

test("pattern recommendation", () => {
  assert.equal(recommendOpenSilverPattern({ needsArbiter: false }).id, "core.freelance-payroll");
  assert.equal(recommendOpenSilverPattern({ needsArbiter: true }).id, "core.escrow-bilateral");
  assert.equal(recommendOpenSilverPattern({ milestones: true }).id, "core.escrow-milestone");
});

test("ksb stub journals lock/release intents", () => {
  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "agent:poster",
    escrowAmount: 1000,
    bondAmount: 100,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "agent:worker");
  backend.submit(job.jobId, "agent:worker", { contentHash: "sha256:covenant" });
  const done = backend.attest(job.jobId, "oracle:ksb", "pass");
  assert.equal(done.state, "Released");
  const actions = backend.journal().map((e) => e.action);
  assert.deepEqual(actions, ["assemble_terms", "lock_bond", "submit_proof", "release"]);
  assert.equal(backend.journal().at(-1).intended.includes("release-proof"), true);
  assert.equal(backend.opensilverPattern.id, "core.escrow-bilateral");
});

test("ksb stub journals slash on fail", () => {
  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "p",
    escrowAmount: 500,
    bondAmount: 50,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "w");
  backend.submit(job.jobId, "w", { contentHash: "sha256:bad" });
  backend.attest(job.jobId, "oracle:ksb", "fail");
  assert.equal(backend.journal().at(-1).action, "slash");
});
