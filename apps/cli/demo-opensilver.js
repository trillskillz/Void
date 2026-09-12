import { mkdirSync } from "node:fs";
import { createKsbStubClient } from "../../packages/sdk/src/index.js";
import { processEscrowDeploy, opensilverConfigFromEnv } from "../../packages/protocol/src/opensilver.js";

const client = createKsbStubClient();
const job = client.openJob({
  poster: "agent:poster",
  escrowAmount: 10_000,
  bondAmount: 1_000,
  verifierId: "oracle:ksb",
});
client.claim(job.jobId, "agent:worker");

console.log("config", opensilverConfigFromEnv(process.env));
const planned = await processEscrowDeploy(client.get(job.jobId), {
  execute: false,
  backend: client.backend,
});
console.log("planned", planned.command);

if (process.env.BONDED_WORK_OPENSILVER === "1") {
  mkdirSync("./data/opensilver-plans", { recursive: true });
  const ran = await processEscrowDeploy(client.get(job.jobId), {
    execute: true,
    backend: client.backend,
  });
  console.log("ran", ran.status, ran.wroteEscrow);
  console.log("escrow", client.get(job.jobId).chain?.escrow);
} else {
  console.log("(set BONDED_WORK_OPENSILVER=1 and OPENSILVER_ROOT to execute)");
}
