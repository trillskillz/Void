import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { createHumanVerifier, createModelStubVerifier } from "../../packages/verifier/src/index.js";

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 1000,
  bondAmount: 100,
  verifierId: "verifier:model-stub",
});
client.claim(job.jobId, "agent:worker");
const artifact = { contentHash: "sha256:demo-verifier" };
client.submit(job.jobId, "agent:worker", artifact);

const model = createModelStubVerifier({ verifierId: "verifier:model-stub" });
const modelAttest = model.attest({ jobId: job.jobId, artifact });
console.log("model", modelAttest.verdict, modelAttest.checks);

const human = createHumanVerifier({ verifierId: "verifier:human" });
const humanAttest = human.attest(
  { jobId: job.jobId, artifact },
  { verdict: modelAttest.verdict, evidenceRef: modelAttest.evidenceRef, note: "confirm stub" }
);
console.log("human", humanAttest.verdict);

const done = client.attest(job.jobId, model.verifierId, modelAttest.verdict, modelAttest.evidenceRef);
console.log("job", done.state, done.payouts);
