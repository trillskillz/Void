# `@bonded-work/sdk`

Client wrapper around the protocol backend (simulator today).

```js
import { createClient } from "@bonded-work/sdk";

const client = createClient();
const job = client.openJob({ poster: "p", escrowAmount: 1000, bondAmount: 50, verifierId: "v" });
```
