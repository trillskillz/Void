import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { processJournal } from "../../packages/protocol/src/harness.js";

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");

const lockEntry = client.journal().find((e) => e.action === "lock_bond");
const results = await processJournal([lockEntry], {
  env: {
    BONDED_WORK_CHAIN: "1",
    KASBONDS_ROOT: process.env.KASBONDS_ROOT || "/tmp/fake-kasbonds",
  },
  execute: true,
  backend: client.backend,
});

console.log("harness", results[0].status, results[0].wroteChain);
console.log("job.chain", client.get(job.jobId).chain);
