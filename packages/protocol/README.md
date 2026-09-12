# `@bonded-work/protocol`

In-memory **job simulator** implementing the Bonded Work state machine.

This is **not** on-chain. Same API shape we expect the real covenant backend to grow into.

```js
import { createSimulator } from "@bonded-work/protocol";

const sim = createSimulator();
const job = sim.openJob({ poster: "a", escrowAmount: 1000, bondAmount: 100, verifierId: "v" });
sim.claim(job.jobId, "worker");
sim.submit(job.jobId, "worker", { contentHash: "sha256:…" });
sim.attest(job.jobId, "v", "pass");
```

## Scripts

```bash
npm test -w @bonded-work/protocol
```
