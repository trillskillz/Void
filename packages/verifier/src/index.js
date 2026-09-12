/**
 * Off-chain verifier stubs.
 * These do not talk to chain — they produce attest payloads for the simulator / CLI.
 */

/** @typedef {'pass'|'fail'} Verdict */

/**
 * Human verifier: trusts an explicit operator decision.
 * @param {{ verifierId?: string }} [opts]
 */
export function createHumanVerifier(opts = {}) {
  const verifierId = opts.verifierId || "verifier:human";
  return {
    kind: "human",
    verifierId,
    /**
     * @param {{ jobId: string, artifact?: object }} ctx
     * @param {{ verdict: Verdict, evidenceRef?: string|null, note?: string }} decision
     */
    attest(ctx, decision) {
      if (!decision || (decision.verdict !== "pass" && decision.verdict !== "fail")) {
        throw new Error("human verifier requires decision.verdict pass|fail");
      }
      return {
        verifierId,
        kind: "human",
        jobId: ctx.jobId,
        verdict: decision.verdict,
        evidenceRef: decision.evidenceRef ?? null,
        note: decision.note ?? null,
        at: Date.now(),
      };
    },
  };
}

/**
 * Model-as-judge stub: deterministic checklist over artifact fields.
 * Not a real model call — replace `score` later with an LLM/oracle.
 * @param {{ verifierId?: string, requireHash?: boolean }} [opts]
 */
export function createModelStubVerifier(opts = {}) {
  const verifierId = opts.verifierId || "verifier:model-stub";
  const requireHash = opts.requireHash !== false;
  return {
    kind: "model-stub",
    verifierId,
    /**
     * @param {{ jobId: string, artifact?: { contentHash?: string, uri?: string } }} ctx
     */
    attest(ctx) {
      const artifact = ctx.artifact || {};
      const checks = [];
      if (requireHash) {
        const ok = typeof artifact.contentHash === "string" && artifact.contentHash.length > 0;
        checks.push({ id: "contentHash", ok });
      }
      if (artifact.uri != null) {
        checks.push({ id: "uri", ok: typeof artifact.uri === "string" && artifact.uri.length > 0 });
      }
      const pass = checks.length === 0 ? false : checks.every((c) => c.ok);
      return {
        verifierId,
        kind: "model-stub",
        jobId: ctx.jobId,
        verdict: pass ? "pass" : "fail",
        evidenceRef: artifact.contentHash || artifact.uri || null,
        checks,
        at: Date.now(),
      };
    },
  };
}
