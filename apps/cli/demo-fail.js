import { createClient } from "../../packages/sdk/src/index.js";
import { modelJudgeStub } from "../../packages/verifier/src/index.js";

const client = createClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 5_000,
  bondAmount: 500,
  verifierId: "verifier:stub",
});
client.claim(job.jobId, "agent:worker");
client.submit(job.jobId, "agent:worker", { contentHash: "sha256:xx", note: "FAIL intentionally" });
const judge = modelJudgeStub({
  rubric: "must pass checks",
  artifact: { contentHash: "sha256:xx" },
  evidenceNote: "FAIL intentionally",
});
const done = client.attest(job.jobId, "verifier:stub", judge.verdict, judge.evidenceRef);
console.log("final", done.state, done.payouts);
