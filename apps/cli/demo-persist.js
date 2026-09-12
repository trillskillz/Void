import { mkdirSync } from "node:fs";
import { createPersistedClient } from "../../packages/sdk/src/index.js";

mkdirSync("./data", { recursive: true });
const dbPath = "./data/demo-jobs.sqlite";

const client = await createPersistedClient({ dbPath });
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 2_000,
  bondAmount: 200,
  verifierId: "verifier:v1",
});
client.claim(job.jobId, "agent:worker");
client.close();
console.log("wrote", dbPath, "job", job.jobId, "Locked");

const again = await createPersistedClient({ dbPath });
const loaded = again.get(job.jobId);
console.log("reloaded", loaded.jobId, loaded.state, loaded.worker);
again.submit(job.jobId, "agent:worker", { contentHash: "sha256:persist-demo" });
const done = again.attest(job.jobId, "verifier:v1", "pass");
console.log("final", done.state, done.payouts);
again.close();
