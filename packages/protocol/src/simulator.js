/** In-memory Bonded Work job simulator. Not on-chain. */

const DEFAULT_FEE_BPS = 300;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

export function createSimulator({ feeBps = DEFAULT_FEE_BPS, now = () => Date.now() } = {}) {
  /** @type {Map<string, object>} */
  const jobs = new Map();
  let seq = 0;

  function get(jobId) {
    const job = jobs.get(jobId);
    assert(job, `unknown job: ${jobId}`);
    return job;
  }

  function snapshot(job) {
    return structuredClone(job);
  }

  return {
    feeBps,
    list() {
      return [...jobs.values()].map(snapshot);
    },
    get(jobId) {
      return snapshot(get(jobId));
    },

    openJob(terms) {
      assert(terms?.poster, "poster required");
      assert(Number(terms.escrowAmount) > 0, "escrowAmount must be > 0");
      assert(Number(terms.bondAmount) >= 0, "bondAmount must be >= 0");
      const jobId = terms.jobId || `job_${++seq}`;
      assert(!jobs.has(jobId), `job exists: ${jobId}`);
      const t = now();
      const job = {
        jobId,
        state: "Open",
        poster: terms.poster,
        worker: null,
        escrowAmount: Number(terms.escrowAmount),
        bondAmount: Number(terms.bondAmount) || 0,
        bondPayer: terms.bondPayer || "poster",
        feeBps: terms.feeBps ?? feeBps,
        verifierId: terms.verifierId || "verifier:default",
        artifactSchema: terms.artifactSchema || "hash+uri",
        claimDeadline: terms.claimDeadline ?? t + 86_400_000,
        submitDeadline: terms.submitDeadline ?? t + 172_800_000,
        challengeWindowMs: terms.challengeWindowMs ?? 3_600_000,
        artifact: null,
        attestation: null,
        payouts: null,
        createdAt: t,
        updatedAt: t,
        events: [{ type: "open", at: t }],
      };
      jobs.set(jobId, job);
      return snapshot(job);
    },

    claim(jobId, worker) {
      const job = get(jobId);
      const t = now();
      assert(job.state === "Open", `cannot claim from ${job.state}`);
      assert(worker, "worker required");
      assert(t <= job.claimDeadline, "claim deadline passed");
      job.worker = worker;
      job.state = "Locked";
      job.updatedAt = t;
      job.events.push({ type: "claim", at: t, worker });
      return snapshot(job);
    },

    submit(jobId, worker, artifact) {
      const job = get(jobId);
      const t = now();
      assert(job.state === "Locked", `cannot submit from ${job.state}`);
      assert(worker === job.worker, "only claiming worker may submit");
      assert(t <= job.submitDeadline, "submit deadline passed");
      assert(artifact?.contentHash, "artifact.contentHash required");
      job.artifact = {
        contentHash: artifact.contentHash,
        uri: artifact.uri || null,
        note: artifact.note || null,
      };
      job.state = "Submitted";
      job.updatedAt = t;
      job.events.push({ type: "submit", at: t, artifact: job.artifact });
      return snapshot(job);
    },

    attest(jobId, verifierId, verdict, evidenceRef = null) {
      const job = get(jobId);
      const t = now();
      assert(job.state === "Submitted" || job.state === "Disputed", `cannot attest from ${job.state}`);
      assert(verifierId === job.verifierId, "verifier mismatch");
      assert(verdict === "pass" || verdict === "fail", "verdict must be pass|fail");
      job.attestation = {
        verdict,
        verifierId,
        evidenceRef,
        artifactHash: job.artifact?.contentHash ?? null,
        issuedAt: t,
      };
      if (verdict === "pass") {
        const fee = Math.floor((job.escrowAmount * job.feeBps) / 10_000);
        const workerPayout = job.escrowAmount - fee;
        job.payouts = {
          worker: workerPayout,
          protocolFee: fee,
          posterBondReturn: job.bondPayer === "poster" ? job.bondAmount : 0,
          workerBondReturn: job.bondPayer === "worker" ? job.bondAmount : 0,
          slash: 0,
        };
        job.state = "Released";
      } else {
        job.payouts = {
          worker: 0,
          protocolFee: 0,
          posterBondReturn: job.bondPayer === "poster" ? 0 : job.bondAmount,
          workerBondReturn: 0,
          slash: job.bondAmount,
          escrowToPoster: job.escrowAmount,
        };
        job.state = "Slashed";
      }
      job.updatedAt = t;
      job.events.push({ type: "attest", at: t, attestation: job.attestation, state: job.state });
      return snapshot(job);
    },

    _hydrate(job) {
      assert(job?.jobId, "hydrate requires jobId");
      assert(!jobs.has(job.jobId), `job exists: ${job.jobId}`);
      jobs.set(job.jobId, structuredClone(job));
      const n = Number(String(job.jobId).replace(/^job_/, ""));
      if (Number.isFinite(n) && n > seq) seq = n;
    },

    expire(jobId) {
      const job = get(jobId);
      const t = now();
      if (job.state === "Open") {
        assert(t > job.claimDeadline, "claim deadline not reached");
        job.state = "Expired";
        job.payouts = {
          worker: 0,
          protocolFee: 0,
          posterBondReturn: job.bondAmount,
          workerBondReturn: 0,
          escrowToPoster: job.escrowAmount,
          slash: 0,
        };
      } else if (job.state === "Locked") {
        assert(t > job.submitDeadline, "submit deadline not reached");
        job.state = "Expired";
        job.payouts = {
          worker: 0,
          protocolFee: 0,
          posterBondReturn: job.bondPayer === "poster" ? Math.floor(job.bondAmount / 2) : 0,
          workerBondReturn: 0,
          escrowToPoster: job.escrowAmount,
          slash: Math.ceil(job.bondAmount / 2),
        };
      } else {
        assert(false, `cannot expire from ${job.state}`);
      }
      job.updatedAt = t;
      job.events.push({ type: "expire", at: t });
      return snapshot(job);
    },
  };
}
