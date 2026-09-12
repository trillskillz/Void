import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { processJournal, harnessConfigFromEnv } from "../../packages/protocol/src/harness.js";

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");
client.submit(job.jobId, "agent:worker", { contentHash: "sha256:harness" });
client.attest(job.jobId, "oracle:ksb", "pass");

const cfg = harnessConfigFromEnv(process.env);
console.log("config", cfg);

const results = await processJournal(client.journal(), {
  execute: process.env.BONDED_WORK_CHAIN === "1",
});
for (const r of results) {
  console.log(
    "-",
    r.action || r.journalEntry?.action,
    r.status || (r.skipped ? "skipped" : "planned"),
    r.wouldRun || r.scriptName || r.reason || ""
  );
}
