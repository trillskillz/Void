# `@bonded-work/protocol`

In-memory simulator + **SQLite persistence** (via `sql.js` wasm — no native addon).

```js
import { createPersistedSimulator } from "@bonded-work/protocol/persisted";

const sim = await createPersistedSimulator({ dbPath: "./data/jobs.sqlite" });
const job = sim.openJob({ poster: "a", escrowAmount: 1000, bondAmount: 100, verifierId: "v" });
sim.close(); // flushes to disk
```

## Scripts

```bash
npm install
npm test -w @bonded-work/protocol
```
