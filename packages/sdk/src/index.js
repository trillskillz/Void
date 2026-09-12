import { createSimulator } from "../../protocol/src/simulator.js";
import { createPersistedSimulator } from "../../protocol/src/persisted.js";

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
    close: () => backend.close?.(),
  };
}

export async function createPersistedClient(options = {}) {
  const backend = await createPersistedSimulator(options);
  return createClient({ backend });
}

export { createSimulator, createPersistedSimulator };
