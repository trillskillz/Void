/**
 * Flag-gated OpenSilver deploy-plan bridge for the escrow leg.
 *
 * Defaults:
 * - disarmed unless BONDED_WORK_OPENSILVER=1
 * - plans the CLI even when disarmed (so demos stay useful)
 * - execute requires OPENSILVER_ROOT (checkout with working `npx opensilver`)
 *
 * Does not fund or broadcast — only builds the deploy-plan JSON artifact shape.
 */

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { recommendOpenSilverPattern } from "./covenant.js";
import { bilateralEscrowCtorArgs, generateEscrowPartyKeys } from "./keys.js";

export function opensilverConfigFromEnv(env = process.env) {
  return {
    enabled: env.BONDED_WORK_OPENSILVER === "1",
    opensilverRoot: env.OPENSILVER_ROOT || null,
    network: env.OPENSILVER_NETWORK || "kaspa:testnet-12",
    outDir: env.BONDED_WORK_OPENSILVER_OUT || "./data/opensilver-plans",
  };
}

/** Deterministic stub pubkeys/hashes for planning (not real keys). */
export function stubCtorArgsForEscrow(job, { timeoutSecs = 14 * 24 * 3600 } = {}) {
  const buyer = createHash("sha256").update(`buyer:${job.poster}`).digest("hex").slice(0, 64);
  const sellerSeed = job.worker || "unclaimed";
  const seller = createHash("sha256").update(`seller:${sellerSeed}`).digest("hex").slice(0, 64);
  // Stub only: real OpenSilver ctors want blake2b(arbiter_pubkey). Replace before funding.
  const arbiterHash = createHash("sha256").update(`arbiter:${job.verifierId}`).digest("hex");
  const timeout = Math.floor(Date.now() / 1000) + timeoutSecs;
  return {
    patternId: "core.escrow-bilateral",
    ctorArgs: [buyer, seller, arbiterHash, timeout],
    note: "stub ctor args derived from job ids — replace with real pubkeys + blake2b arbiter hash before funding",
  };
}

export function planDeployPlan(job, config, opts = {}) {
  const pattern =
    opts.pattern ||
    recommendOpenSilverPattern({
      needsArbiter: opts.needsArbiter !== false,
      milestones: !!opts.milestones,
    });
  let ctor = opts.ctor;
  if (!ctor && opts.keys) {
    ctor = bilateralEscrowCtorArgs(opts.keys);
  }
  if (!ctor && opts.generateKeys) {
    ctor = generateEscrowPartyKeys().ctorArgs;
  }
  if (!ctor) {
    ctor = stubCtorArgsForEscrow(job).ctorArgs;
  }

  const args = [
    "opensilver",
    "deploy-plan",
    pattern.id,
    "--ctor",
    JSON.stringify(ctor),
    "--network",
    config.network,
  ];
  if (config.opensilverRoot) {
    args.push("--repo-root", config.opensilverRoot);
  }

  const shellArgs = args.map((a) =>
    /[\s\[\]{}"'`]/.test(String(a)) ? JSON.stringify(String(a)) : String(a)
  );
  return {
    ok: true,
    patternId: pattern.id,
    network: config.network,
    ctorArgs: ctor,
    argv: args,
    command: `npx ${shellArgs.join(" ")}`,
    enabled: config.enabled,
    opensilverRoot: config.opensilverRoot,
  };
}

export function runDeployPlan(plan, { spawnFn = spawn, env = process.env, outPath = null } = {}) {
  return new Promise((resolve, reject) => {
    if (!plan.enabled) {
      resolve({ ...plan, status: "skipped", reason: "BONDED_WORK_OPENSILVER != 1" });
      return;
    }
    if (!plan.opensilverRoot) {
      resolve({ ...plan, status: "skipped", reason: "OPENSILVER_ROOT not set" });
      return;
    }

    // Prefer local CLI entry if present; else npx opensilver from that root
    const cliJs = join(plan.opensilverRoot, "cli", "dist", "index.js");
    const cliTsRunner = join(plan.opensilverRoot, "node_modules", ".bin", "opensilver");
    let cmd;
    let cmdArgs;
    try {
      accessSync(cliTsRunner, fsConstants.X_OK);
      cmd = cliTsRunner;
      cmdArgs = plan.argv.slice(1); // drop leading 'opensilver'
    } catch {
      cmd = process.execPath;
      // fake/test harness: allow OPENSILVER_DEPLOY_BIN
      if (env.OPENSILVER_DEPLOY_BIN) {
        cmd = env.OPENSILVER_DEPLOY_BIN;
        cmdArgs = plan.argv.slice(1);
      } else {
        cmd = "npx";
        cmdArgs = plan.argv;
      }
    }

    const child = spawnFn(cmd, cmdArgs, {
      cwd: plan.opensilverRoot,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      let parsed = null;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        const s = stdout.lastIndexOf("{");
        const e = stdout.lastIndexOf("}");
        if (s >= 0 && e > s) {
          try {
            parsed = JSON.parse(stdout.slice(s, e + 1));
          } catch {
            parsed = null;
          }
        }
      }
      if (outPath && parsed) {
        mkdirSync(join(outPath, ".."), { recursive: true });
        writeFileSync(outPath, JSON.stringify(parsed, null, 2));
      }
      resolve({
        ...plan,
        status: code === 0 ? "ok" : "failed",
        code,
        stdout,
        stderr,
        parsed,
        deployPlanPath: outPath,
      });
    });
  });
}

/**
 * Plan (and optionally execute) an OpenSilver deploy-plan for a job's escrow leg.
 */
export async function processEscrowDeploy(job, opts = {}) {
  const env = opts.env || process.env;
  const config = { ...opensilverConfigFromEnv(env), ...opts.config };
  const plan = planDeployPlan(job, config, opts);
  if (opts.execute !== true) {
    return { ...plan, status: "planned" };
  }
  const outPath = join(config.outDir, `${job.jobId}-${plan.patternId}.json`);
  const ran = await runDeployPlan(plan, { ...opts, env, outPath });
  if (ran.status === "ok" && opts.backend?.recordEscrowPlan) {
    const escrowMeta = {
      patternId: plan.patternId,
      network: plan.network,
      ctorArgs: plan.ctorArgs,
      p2shCommitment: ran.parsed?.p2shCommitment ?? null,
      entrypoints: ran.parsed?.deployment?.entrypoints ?? null,
      deployPlanPath: outPath,
      raw: ran.parsed,
    };
    const updated = opts.backend.recordEscrowPlan(job.jobId, escrowMeta);
    ran.chain = updated.chain;
    ran.wroteEscrow = true;
  }
  return ran;
}
