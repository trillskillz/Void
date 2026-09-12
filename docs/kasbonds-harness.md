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

## Demo

```bash
# plan only (default)
npm run demo:harness

# dry-run spawn (needs KasBonds checkout; still DRY_RUN=1)
KASBONDS_ROOT=/path/to/KasBonds BONDED_WORK_CHAIN=1 npm run demo:harness
```

## Not in this PR

- Funding wallets / faucet
- Recording lock txid back into the job row automatically after a live lock (follow-up)
