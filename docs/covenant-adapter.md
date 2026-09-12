# Covenant adapter (spike)

Bonded Work stays product-shaped. On-chain work reuses what you already built:

| Concern | Reuse |
|---|---|
| Service bond lock / release / slash | **KasBonds** (KSB) — TN12 release+slash proofs exist |
| Job escrow mediation | **OpenSilver** — Bilateral Escrow (3.5), Milestone Escrow (3.6), or Freelance/Payroll (3.12) |
| Discovery | out of scope (clawdmarket later) |

## Recommended composition (MVP chain path)

1. **Escrow leg (optional for tiny jobs):** OpenSilver *Freelance/Payroll* when happy-path is mutual release; *Bilateral Escrow* when an arbiter/verifier must tilt funds.
2. **Bond leg (required for trust-minimized cold agents):** KasBonds / KSB minimum bond — verifier-oracle release before deadline, slash after fail/expiry.

Bonded Work's simulator states are the **product** state machine. The adapter maps them onto KasBonds lifecycle labels and records intended covenant actions (not yet broadcasting txs from this repo).

## State map

| Bonded Work | KasBonds lifecycle (approx) | Intended chain action |
|---|---|---|
| Open | draft / offered | assemble terms |
| Locked | active (bond locked) | lock bond (+ optional escrow) |
| Submitted | verification_pending | worker claimed done |
| Released | approved → released | oracle/verifier release tx |
| Slashed | rejected/expired → slashed | slash tx |
| Expired | expired → slashed or refund | policy-dependent |
| Disputed | (extension; not in KSB min machine) | panel / challenge — later |

## What this spike ships

- `CovenantBackend` interface (same verbs as the simulator)
- `createKsbStubBackend` — durable in-memory/SQLite product state **plus** a KSB-shaped journal of intended on-chain steps
- mapping helpers + tests
- **no** TN12 broadcast from Void (use KasBonds harness when ready)

## What is explicitly not claimed

- No mainnet / TN12 proof from this repo yet
- No SilverScript source copied here (link out to OpenSilver/KasBonds)
- No fee revenue

## Compose dry-run

`npm run demo:compose` runs OpenSilver deploy-plan then KasBonds lock-bond against the same job (both flag-gated, dry-run by default). See `docs/cli.md`.
