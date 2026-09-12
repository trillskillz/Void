/**
 * Covenant backend interface + KasBonds-shaped stub adapter.
 * Does not broadcast chain txs — journals intended actions for a later harness hook.
 */

import { createSimulator } from "./simulator.js";

/** @typedef {'draft'|'offered'|'accepted'|'funding_pending'|'active'|'verification_pending'|'approved'|'rejected'|'expired'|'released'|'slashed'|'failed_execution'} KsbLifecycle */

export const BONDED_TO_KSB = {
  Open: "offered",
  Locked: "active",
  Submitted: "verification_pending",
  Released: "released",
  Slashed: "slashed",
  Expired: "expired",
  Disputed: "verification_pending", // challenge extension; not in KSB min machine
};

export const OPENSILVER_PATTERNS = {
  mutualHappyPath: {
    id: "core.freelance-payroll",
    repoPath: "contracts/core/freelance-payroll.sil",
    why: "Happy path is mutual release; client-favored timeout",
  },
  arbiterTilt: {
    id: "core.escrow-bilateral",
    repoPath: "contracts/core/escrow-bilateral.sil",
    why: "Verifier/arbiter tilts release vs refund without holding funds",
  },
  milestones: {
    id: "core.escrow-milestone",
    repoPath: "contracts/core/escrow-milestone.sil",
    why: "Multi-deliverable jobs with per-milestone signoff",
  },
};

export function mapBondedStateToKsb(state) {
  const mapped = BONDED_TO_KSB[state];
  if (!mapped) throw new Error(`no KSB mapping for state: ${state}`);
  return mapped;
}

export function recommendOpenSilverPattern({ needsArbiter = true, milestones = false } = {}) {
  if (milestones) return OPENSILVER_PATTERNS.milestones;
  if (needsArbiter) return OPENSILVER_PATTERNS.arbiterTilt;
  return OPENSILVER_PATTERNS.mutualHappyPath;
}

/**
 * Product simulator + covenant journal.
 * Journal entries are the template for KasBonds script hooks (lock/release/slash).
 */
export function createKsbStubBackend({ feeBps, now, pattern } = {}) {
  const sim = createSimulator({ feeBps, now });
  const chosen = pattern || recommendOpenSilverPattern({ needsArbiter: true });
  /** @type {object[]} */
  const journal = [];

  function note(action, job, extra = {}) {
    const entry = {
      at: (now || Date.now)(),
      action,
      jobId: job.jobId,
      bondedState: job.state,
      ksbLifecycle: mapBondedStateToKsb(job.state),
      opensilverPattern: chosen.id,
      ...extra,
    };
    journal.push(entry);
    return entry;
  }

  return {
    kind: "ksb-stub",
    opensilverPattern: chosen,
    journal: () => journal.map((e) => structuredClone(e)),
    list: () => sim.list(),
    get: (id) => sim.get(id),
    recordChainLock: (jobId, meta) => {
      const job = sim.recordChainLock(jobId, meta);
      note("chain_lock_recorded", job, {
        intended: "persist BOND_LOCK_TXID for release/slash scripts",
        chain: job.chain,
      });
      return job;
    },

    openJob(terms) {
      const job = sim.openJob({
        ...terms,
        // default verifier id doubles as KSB oracle role label
        verifierId: terms.verifierId || "oracle:ksb",
      });
      note("assemble_terms", job, {
        intended: "kasbonds.draft→offered",
        escrowAmount: job.escrowAmount,
        bondAmount: job.bondAmount,
      });
      return job;
    },

    claim(jobId, worker) {
      const job = sim.claim(jobId, worker);
      note("lock_bond", job, {
        intended: "kasbonds.lock tx (funding_pending→active)",
        worker,
        refs: {
          kasbonds: "scripts/lock-bond.mjs",
          opensilver: chosen.repoPath,
        },
      });
      return job;
    },

    submit(jobId, worker, artifact) {
      const job = sim.submit(jobId, worker, artifact);
      note("submit_proof", job, {
        intended: "kasbonds.verification_pending + proof submit",
        artifact,
      });
      return job;
    },

    attest(jobId, verifierId, verdict, evidenceRef = null) {
      const job = sim.attest(jobId, verifierId, verdict, evidenceRef);
      if (verdict === "pass") {
        note("release", job, {
          intended: "kasbonds.release-proof tx (approved→released)",
          refs: { kasbonds: "scripts/release-proof.mjs" },
          evidenceRef,
        });
      } else {
        note("slash", job, {
          intended: "kasbonds.slash-proof tx (rejected→slashed)",
          refs: { kasbonds: "scripts/slash-proof.mjs" },
          evidenceRef,
        });
      }
      return job;
    },

    expire(jobId) {
      const job = sim.expire(jobId);
      note("expire", job, {
        intended: "kasbonds.expired → slash or refund per policy",
      });
      return job;
    },
  };
}
