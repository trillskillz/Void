import { createClient } from "../../packages/sdk/src/index.js";
import { modelJudgeStub } from "../../packages/verifier/src/index.js";

const client = createClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "verifier:stub",
});
console.log("opened", job.jobId, job.state);

client.claim(job.jobId, "agent:worker");
client.submit(job.jobId, "agent:worker", {
  contentHash: "sha256:deadbeefcafebabe",
  uri: "ipfs://demo",
  note: "delivered",
});

const judge = modelJudgeStub({
  rubric: "deliver hash+uri",
  artifact: { contentHash: "sha256:deadbeefcafebabe" },
});
const done = client.attest(job.jobId, "verifier:stub", judge.verdict, judge.evidenceRef);
console.log("final", done.state, done.payouts);
