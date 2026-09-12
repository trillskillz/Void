import { createSimulator } from "@bonded-work/protocol";

/** Thin client over a protocol backend (simulator by default). */
export function createClient(options = {}) {
  const backend = options.backend || createSimulator(options);
  return {
    backend,
    openJob: (terms) => backend.openJob(terms),
    claim: (jobId, worker) => backend.claim(jobId, worker),
    submit: (jobId, worker, artifact) => backend.submit(jobId, worker, artifact),
    attest: (jobId, verifierId, verdict, evidenceRef) =>
      backend.attest(jobId, verifierId, verdict, evidenceRef),
    expire: (jobId) => backend.expire(jobId),
    get: (jobId) => backend.get(jobId),
    list: () => backend.list(),
  };
}

export { createSimulator };
