/**
 * Flag-gated KasBonds TN12 harness bridge.
 *
 * Safety defaults:
 * - disabled unless BONDED_WORK_CHAIN=1
 * - always sets DRY_RUN=1 unless BONDED_WORK_CHAIN_LIVE=1
 * - never invents private keys; passes through env / explicit opts
 *
 * Requires a local KasBonds checkout via KASBONDS_ROOT when executing.
 */

import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { join } from "node:path";

export const ACTION_TO_SCRIPT = {
  lock_bond: "lock-bond.mjs",
  release: "release-proof.mjs",
  slash: "slash-proof.mjs",
};

export function harnessConfigFromEnv(env = process.env) {
  const enabled = env.BONDED_WORK_CHAIN === "1";
  const live = env.BONDED_WORK_CHAIN_LIVE === "1";
  const kasbondsRoot = env.KASBONDS_ROOT || null;
  return {
    enabled,
    live,
    dryRun: !live,
    kasbondsRoot,
  };
}

export function planHarnessExec(journalEntry, config, env = process.env) {
  const scriptName = ACTION_TO_SCRIPT[journalEntry.action];
  if (!scriptName) {
    return {
      ok: false,
      skipped: true,
      reason: `no chain script for action: ${journalEntry.action}`,
      journalEntry,
    };
  }

  if (!config.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "BONDED_WORK_CHAIN != 1 (harness disarmed)",
      wouldRun: scriptName,
      dryRun: true,
      journalEntry,
    };
  }

  if (!config.kasbondsRoot) {
    return {
      ok: false,
      skipped: true,
      reason: "KASBONDS_ROOT not set",
      wouldRun: scriptName,
      journalEntry,
    };
  }

  const scriptPath = join(config.kasbondsRoot, "scripts", scriptName);
  const childEnv = {
    ...env,
    DRY_RUN: config.dryRun ? "1" : "0",
  };

  // Map Bonded Work job economics into KasBonds env when present
  if (journalEntry.escrowAmount != null || journalEntry.bondAmount != null) {
    const sompi = BigInt(journalEntry.bondAmount ?? journalEntry.escrowAmount ?? 0) * 100_000_000n;
    // bondAmount in product units is abstract; if already sompi-sized leave alone when env set
    if (!childEnv.BOND_AMOUNT_SOMPI && journalEntry.bondAmount != null) {
      // treat product bondAmount as KAS * 1e8 only when explicitly flagged
      if (env.BONDED_WORK_AMOUNT_UNIT === "kas") {
        childEnv.BOND_AMOUNT_SOMPI = String(BigInt(journalEntry.bondAmount) * 100_000_000n);
      }
    }
  }

  if (journalEntry.lockTxid) childEnv.BOND_LOCK_TXID = String(journalEntry.lockTxid);
  if (journalEntry.lockVout != null) childEnv.BOND_LOCK_VOUT = String(journalEntry.lockVout);

  return {
    ok: true,
    skipped: false,
    scriptName,
    scriptPath,
    cwd: config.kasbondsRoot,
    dryRun: config.dryRun,
    env: {
      DRY_RUN: childEnv.DRY_RUN,
      BOND_AMOUNT_SOMPI: childEnv.BOND_AMOUNT_SOMPI,
      BOND_LOCK_TXID: childEnv.BOND_LOCK_TXID,
      BOND_LOCK_VOUT: childEnv.BOND_LOCK_VOUT,
      TN12_NETWORK: childEnv.TN12_NETWORK,
      TN12_WRPC_URL: childEnv.TN12_WRPC_URL,
    },
    journalEntry,
  };
}

export function assertScriptExists(scriptPath) {
  accessSync(scriptPath, fsConstants.R_OK);
}

/**
 * Execute a planned harness step. Rejects live mode unless BONDED_WORK_CHAIN_LIVE=1
 * was already reflected in config.live.
 */
export function runHarnessPlan(plan, { spawnFn = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (plan.skipped) {
      resolve({ ...plan, status: "skipped" });
      return;
    }
    try {
      assertScriptExists(plan.scriptPath);
    } catch (err) {
      reject(new Error(`KasBonds script missing: ${plan.scriptPath} (${err.message})`));
      return;
    }

    const child = spawnFn(process.execPath, [plan.scriptPath], {
      cwd: plan.cwd,
      env: { ...process.env, ...Object.fromEntries(Object.entries(plan.env).filter(([, v]) => v != null)) },
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
      resolve({
        ...plan,
        status: code === 0 ? "ok" : "failed",
        code,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Drive chain hooks for journal entries that have scripts.
 * Default: plan only (no spawn) unless execute=true.
 */
export async function processJournal(journal, opts = {}) {
  const env = opts.env || process.env;
  const config = { ...harnessConfigFromEnv(env), ...opts.config };
  const execute = opts.execute === true;
  const results = [];

  for (const entry of journal) {
    if (!ACTION_TO_SCRIPT[entry.action]) {
      results.push({
        ok: true,
        skipped: true,
        reason: "non-chain journal action",
        action: entry.action,
      });
      continue;
    }
    const plan = planHarnessExec(entry, config, env);
    if (!execute || plan.skipped) {
      results.push({ ...plan, status: plan.skipped ? "skipped" : "planned" });
      continue;
    }
    results.push(await runHarnessPlan(plan, opts));
  }
  return results;
}
