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

  if (journalEntry.escrowAmount != null || journalEntry.bondAmount != null) {
    if (!childEnv.BOND_AMOUNT_SOMPI && journalEntry.bondAmount != null) {
      if (env.BONDED_WORK_AMOUNT_UNIT === "kas") {
        childEnv.BOND_AMOUNT_SOMPI = String(BigInt(journalEntry.bondAmount) * 100_000_000n);
      }
    }
  }

  if (journalEntry.lockTxid) childEnv.BOND_LOCK_TXID = String(journalEntry.lockTxid);
  if (journalEntry.lockVout != null) childEnv.BOND_LOCK_VOUT = String(journalEntry.lockVout);
  // Prefer chain meta already on the job if journal carried it
  if (journalEntry.chain?.lockTxid) childEnv.BOND_LOCK_TXID = String(journalEntry.chain.lockTxid);
  if (journalEntry.chain?.lockVout != null) childEnv.BOND_LOCK_VOUT = String(journalEntry.chain.lockVout);

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

/** Extract the last JSON object from KasBonds script stdout (dry-run or live summary). */
export function parseHarnessStdout(stdout) {
  if (!stdout || !String(stdout).trim()) return null;
  const text = String(stdout).trim();
  // Prefer full parse; else last {...} block
  try {
    return JSON.parse(text);
  } catch {
    const start = text.lastIndexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Map lock-bond script JSON → job.chain fields. */
export function chainMetaFromLockResult(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const lockTxid = parsed.finalTransactionId || parsed.lockTxid || parsed.txid || null;
  const covenantAddress = parsed.covenantAddress || null;
  const lockVout = parsed.lockVout ?? parsed.vout ?? 0;
  if (!lockTxid && !covenantAddress) return null;
  return {
    lockTxid,
    lockVout,
    covenantAddress,
    lockMode: parsed.mode || (parsed.dryRun || parsed.DRY_RUN ? "dry-run" : "live"),
    raw: parsed,
  };
}

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
      env: {
        ...process.env,
        ...Object.fromEntries(Object.entries(plan.env).filter(([, v]) => v != null)),
      },
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
      const parsed = parseHarnessStdout(stdout);
      resolve({
        ...plan,
        status: code === 0 ? "ok" : "failed",
        code,
        stdout,
        stderr,
        parsed,
      });
    });
  });
}

/**
 * @param {object[]} journal
 * @param {object} opts
 * @param {object} [opts.backend] - if provided and has recordChainLock, lock results write back
 */
export async function processJournal(journal, opts = {}) {
  const env = opts.env || process.env;
  const config = { ...harnessConfigFromEnv(env), ...opts.config };
  const execute = opts.execute === true;
  const backend = opts.backend || null;
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
    // Enrich journal entry with chain meta from backend job if present
    let enriched = entry;
    if (backend?.get && entry.jobId) {
      try {
        const job = backend.get(entry.jobId);
        if (job?.chain) enriched = { ...entry, chain: job.chain, lockTxid: job.chain.lockTxid, lockVout: job.chain.lockVout };
      } catch {
        /* ignore */
      }
    }

    const plan = planHarnessExec(enriched, config, env);
    if (!execute || plan.skipped) {
      results.push({ ...plan, status: plan.skipped ? "skipped" : "planned" });
      continue;
    }

    const ran = await runHarnessPlan(plan, opts);
    if (
      ran.status === "ok" &&
      entry.action === "lock_bond" &&
      backend &&
      typeof backend.recordChainLock === "function"
    ) {
      const meta = chainMetaFromLockResult(ran.parsed);
      if (meta) {
        const updated = backend.recordChainLock(entry.jobId, meta);
        ran.chain = updated.chain;
        ran.wroteChain = true;
      }
    }
    results.push(ran);
  }
  return results;
}
