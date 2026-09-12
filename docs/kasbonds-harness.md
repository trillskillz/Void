# KasBonds harness bridge

Connects Bonded Work journal actions to the KasBonds TN12 scripts in a **sibling checkout**.

## Safety

| Flag | Meaning |
|---|---|
| *(unset)* | Harness **disarmed**. Plans only; never spawns. |
| `BONDED_WORK_CHAIN=1` | Allow spawn against `KASBONDS_ROOT`. Still **DRY_RUN=1** unless live. |
| `BONDED_WORK_CHAIN_LIVE=1` | Actually broadcast (dangerous). Requires chain=1. |
| `KASBONDS_ROOT` | Absolute path to a KasBonds clone with `scripts/*.mjs`. |

Private keys are **never** written by Bonded Work. Export them in the shell / KasBonds `.env.local` the same way the KasBonds harness already expects (`TN12_PRIVATE_KEY`, oracle/slash keys, etc.).

## Action map

| Journal action | Script |
|---|---|
| `lock_bond` | `scripts/lock-bond.mjs` |
| `release` | `scripts/release-proof.mjs` |
| `slash` | `scripts/slash-proof.mjs` |

## Node WebSocket

Kaspa wasm RPC needs `globalThis.WebSocket` even for `DRY_RUN`. Bonded Work spawns scripts via `kasbonds-runner.mjs`, which loads the `websocket` package from the KasBonds checkout.

```bash
cd /path/to/KasBonds && npm install websocket
```

## Demo

```bash
# plan only (default)
npm run demo:harness

# dry-run spawn + lock txid write-back
KASBONDS_ROOT=/path/to/KasBonds BONDED_WORK_CHAIN=1 node apps/cli/demo-lock-txid.js
```

## Out of scope here

- Funding wallets / faucet
- Live TN12 broadcast (`BONDED_WORK_CHAIN_LIVE=1`) without an explicit operator decision


## Lock → release lifecycle

```bash
KASBONDS_ROOT=/path/to/KasBonds BONDED_WORK_CHAIN=1 npm run demo:lifecycle
```

Dry-run **lock** builds a tx and writes `job.chain.{lockTxid,lockVout,covenantAddress}` without broadcasting.
Dry-run **release/slash** still asks KasBonds for a real UTXO at that outpoint. Until a live lock funds the covenant (or you point `BOND_LOCK_TXID` at an existing TN12 UTXO), release will exit with "Could not resolve covenant UTXO".

## CLI settle

```bash
node apps/cli/bonded.js settle --db ./data/jobs.sqlite --ksb --job job_1
```

Runs `processJournal` on the job's `release` or `slash` entry. See `docs/cli.md`.
