import { createKsbStubClient } from "../../packages/sdk/src/index.js";

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");
client.submit(job.jobId, "agent:worker", { contentHash: "sha256:covenant-demo", uri: "ipfs://job" });
const done = client.attest(job.jobId, "oracle:ksb", "pass");
console.log("final", done.state, done.payouts);
console.log("journal:");
for (const e of client.journal()) {
  console.log("-", e.action, "→", e.ksbLifecycle, "|", e.intended);
}
console.log("opensilver pattern:", client.backend.opensilverPattern.id);
