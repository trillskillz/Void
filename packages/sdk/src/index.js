import { createSimulator } from "../../protocol/src/simulator.js";
import { createPersistedSimulator } from "../../protocol/src/persisted.js";
import { createKsbStubBackend } from "../../protocol/src/covenant.js";
import { processJournal, harnessConfigFromEnv } from "../../protocol/src/harness.js";
import { processEscrowDeploy, opensilverConfigFromEnv } from "../../protocol/src/opensilver.js";
import { generateEscrowPartyKeys, bilateralEscrowCtorArgs, generateSecp256k1Keypair } from "../../protocol/src/keys.js";

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
    recordChainLock: (jobId, meta) => backend.recordChainLock?.(jobId, meta),
    recordEscrowPlan: (jobId, plan) => backend.recordEscrowPlan?.(jobId, plan),
    get: (jobId) => backend.get(jobId),
    list: () => backend.list(),
    journal: () => backend.journal?.() ?? [],
    close: () => backend.close?.(),
  };
}

export async function createPersistedClient(options = {}) {
  const backend = await createPersistedSimulator(options);
  return createClient({ backend });
}

export function createKsbStubClient(options = {}) {
  return createClient({ backend: createKsbStubBackend(options) });
}

export {
  createSimulator,
  createPersistedSimulator,
  createKsbStubBackend,
  processJournal,
  harnessConfigFromEnv,
  processEscrowDeploy,
  opensilverConfigFromEnv,
  generateEscrowPartyKeys,
  bilateralEscrowCtorArgs,
  generateSecp256k1Keypair,
};
