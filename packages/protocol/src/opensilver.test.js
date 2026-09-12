import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  opensilverConfigFromEnv,
  planDeployPlan,
  processEscrowDeploy,
  stubCtorArgsForEscrow,
} from "./opensilver.js";
import { createKsbStubBackend } from "./covenant.js";

test("opensilver disarmed by default", () => {
  const cfg = opensilverConfigFromEnv({});
  assert.equal(cfg.enabled, false);
});

test("stub ctor has bilateral shape", () => {
  const job = { poster: "p", worker: "w", verifierId: "v" };
  const stub = stubCtorArgsForEscrow(job);
  assert.equal(stub.ctorArgs.length, 4);
  assert.equal(typeof stub.ctorArgs[0], "string");
  assert.equal(typeof stub.ctorArgs[3], "number");
});

test("planDeployPlan emits opensilver CLI", () => {
  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "agent:poster",
    escrowAmount: 100,
    bondAmount: 10,
    verifierId: "oracle:ksb",
  });
  const plan = planDeployPlan(job, {
    enabled: false,
    opensilverRoot: null,
    network: "kaspa:testnet-12",
  });
  assert.equal(plan.patternId, "core.escrow-bilateral");
  assert.match(plan.command, /deploy-plan core\.escrow-bilateral/);
  assert.equal(plan.status, undefined);
});

test("processEscrowDeploy execute writes plan onto job via fake CLI", async () => {
  const dir = join(tmpdir(), `os-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, "fake-opensilver");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const plan = {
  patternId: "core.escrow-bilateral",
  deployment: { entrypoints: ["release_to_seller", "refund_to_buyer", "timeout_reclaim"] },
  p2shCommitment: { scheme: "p2sh", redeemScriptHex: "00" },
};
console.log(JSON.stringify(plan));
`
  );
  chmodSync(bin, 0o755);

  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "agent:poster",
    escrowAmount: 100,
    bondAmount: 10,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "agent:worker");

  const result = await processEscrowDeploy(job, {
    env: {
      BONDED_WORK_OPENSILVER: "1",
      OPENSILVER_ROOT: dir,
      OPENSILVER_DEPLOY_BIN: bin,
      BONDED_WORK_OPENSILVER_OUT: join(dir, "out"),
    },
    execute: true,
    backend,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.wroteEscrow, true);
  const loaded = backend.get(job.jobId);
  assert.equal(loaded.chain.escrow.patternId, "core.escrow-bilateral");
  assert.deepEqual(loaded.chain.escrow.entrypoints, [
    "release_to_seller",
    "refund_to_buyer",
    "timeout_reclaim",
  ]);
});

test("processEscrowDeploy records escrowAddress from deriver", async () => {
  const dir = join(tmpdir(), `os-addr-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, "fake-opensilver");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const plan = {
  patternId: "core.escrow-bilateral",
  compiled: { scriptHex: "00ff", scriptLength: 2 },
  deployment: { entrypoints: ["release_to_seller"] },
  p2shCommitment: { scheme: "p2sh", redeemScriptHex: "00ff" },
};
console.log(JSON.stringify(plan));
`
  );
  chmodSync(bin, 0o755);

  const backend = createKsbStubBackend();
  const job = backend.openJob({
    poster: "agent:poster",
    escrowAmount: 100,
    bondAmount: 10,
    verifierId: "oracle:ksb",
  });
  backend.claim(job.jobId, "agent:worker");

  const result = await processEscrowDeploy(job, {
    env: {
      BONDED_WORK_OPENSILVER: "1",
      OPENSILVER_ROOT: dir,
      OPENSILVER_DEPLOY_BIN: bin,
      BONDED_WORK_OPENSILVER_OUT: join(dir, "out"),
    },
    execute: true,
    backend,
    deriver: () => "kaspatest:qescrowderived",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.escrowAddress, "kaspatest:qescrowderived");
  assert.equal(backend.get(job.jobId).chain.escrow.escrowAddress, "kaspatest:qescrowderived");
});
