import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKsbStubClient, processEscrowDeploy } from "../../packages/sdk/src/index.js";

const CLI = new URL("./bonded.js", import.meta.url).pathname;

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: process.env,
  });
}

test("help exits 0", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Bonded Work CLI/);
});

test("happy path via cli + sqlite", () => {
  const dir = mkdtempSync(join(tmpdir(), "bonded-cli-"));
  const db = join(dir, "jobs.sqlite");
  try {
    let r = run([
      "open",
      "--db",
      db,
      "--poster",
      "agent:poster",
      "--escrow",
      "1000",
      "--bond",
      "100",
      "--verifier",
      "v1",
      "--job",
      "job_cli",
    ]);
    assert.equal(r.status, 0, r.stderr);

    r = run(["claim", "--db", db, "--job", "job_cli", "--worker", "agent:worker"]);
    assert.equal(r.status, 0, r.stderr);

    r = run([
      "submit",
      "--db",
      db,
      "--job",
      "job_cli",
      "--worker",
      "agent:worker",
      "--hash",
      "sha256:cli",
    ]);
    assert.equal(r.status, 0, r.stderr);

    r = run(["attest", "--db", db, "--job", "job_cli", "--verifier", "v1", "--verdict", "pass"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).state, "Released");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ksb journal + escrow plan helpers", async () => {
  const client = createKsbStubClient();
  const job = client.openJob({
    poster: "p",
    escrowAmount: 10,
    bondAmount: 1,
    verifierId: "v",
    jobId: "job_ksb",
  });
  client.claim("job_ksb", "w");
  assert.ok(client.journal().some((e) => e.action === "lock_bond"));
  const plan = await processEscrowDeploy(client.get("job_ksb"), { execute: false });
  assert.match(plan.command, /deploy-plan/);
});

test("compose plans without execute flags", () => {
  const dir = mkdtempSync(join(tmpdir(), "bonded-compose-"));
  const db = join(dir, "jobs.sqlite");
  try {
    let r = run([
      "open",
      "--db",
      db,
      "--ksb",
      "--poster",
      "p",
      "--escrow",
      "10",
      "--bond",
      "1",
      "--verifier",
      "v",
      "--job",
      "job_c",
    ]);
    assert.equal(r.status, 0, r.stderr);
    r = run(["claim", "--db", db, "--ksb", "--job", "job_c", "--worker", "w"]);
    assert.equal(r.status, 0, r.stderr);
    r = run(["compose", "--db", db, "--ksb", "--job", "job_c"]);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.jobId, "job_c");
    assert.ok(out.escrow);
    assert.ok(out.lock);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
