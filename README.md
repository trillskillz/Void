# Bonded Work

Kaspa-native **covenant escrow for agent-to-agent jobs**.

An agent posts work and a bond. Another agent claims it. Funds lock in a covenant. Release happens only when a verifier attests the outcome. Disputes slash or split the bond.

This repo is a **runnable product sketch** — local simulator + flag-gated dry-runs against [KasBonds](https://github.com/trillskillz/KasBonds) and [OpenSilver](https://github.com/trillskillz/OpenSilver). It is **not** a live mainnet protocol.

## Status

| Layer | State |
|---|---|
| In-memory job simulator + fees | done |
| SQLite persistence (`--db`) | done |
| KasBonds lock/release/slash harness (dry-run) | done |
| OpenSilver escrow deploy-plan + P2SH address | done |
| Compose both legs on one job | done (`demo:compose` / `bonded compose`) |
| Verifier adapters (human + model stub) | stub |
| Live TN12 broadcast | **off** unless `BONDED_WORK_CHAIN_LIVE=1` |

## Quick start

```bash
npm install
npm test
npm run demo:happy
npm run demo:fail
```

### Persist + CLI

```bash
npm run demo:persist
node apps/cli/bonded.js help

node apps/cli/bonded.js open --db ./data/jobs.sqlite --ksb \
  --poster agent:p --escrow 1000 --bond 100 --verifier oracle:ksb --job job_1
node apps/cli/bonded.js claim --db ./data/jobs.sqlite --ksb --job job_1 --worker agent:w
```

### Compose dry-run (both covenant legs)

Needs local checkouts + `websocket` in KasBonds (`npm i websocket`), OpenSilver built with `bootstrap:silverc` (rustc ≥ 1.90).

```bash
BONDED_WORK_OPENSILVER=1 OPENSILVER_ROOT=/path/to/OpenSilver \
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/path/to/KasBonds \
  npm run demo:compose
```

Or via CLI (persists chain meta):

```bash
BONDED_WORK_OPENSILVER=1 OPENSILVER_ROOT=/path/to/OpenSilver \
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/path/to/KasBonds \
  node apps/cli/bonded.js compose --db ./data/jobs.sqlite --ksb --job job_1
```

## Safety flags

| Flag | Meaning |
|---|---|
| *(unset)* | Plan / simulate only |
| `BONDED_WORK_CHAIN=1` | Allow KasBonds script spawn (`DRY_RUN=1` unless live) |
| `BONDED_WORK_CHAIN_LIVE=1` | Actually broadcast (dangerous) |
| `KASBONDS_ROOT` | Path to KasBonds checkout |
| `BONDED_WORK_OPENSILVER=1` | Allow OpenSilver deploy-plan execute |
| `OPENSILVER_ROOT` | Path to OpenSilver checkout |
| `KASPA_WASM_PATH` | Optional override for P2SH address derive |

Private keys are **never** invented by Bonded Work. Use `bonded keys generate` / KasBonds env the same way those repos already expect.

## Problem

Agents already hire each other (compute, tools, scrapers, codegen). Trust is still theater: screenshots, reputation scores, hope. Cold agents cannot trade large jobs without a settlement rail that can **lock, release, and slash**.

## How it works

### Happy path

1. **Poster** opens a job with escrow + bond terms and a verifier policy.
2. **Worker** claims the job; covenant locks funds.
3. Worker **submits** an artifact / proof pointer.
4. **Verifier** attests pass → covenant **releases** escrow to worker (minus protocol fee).
5. Bond returns per terms.

### Dispute path

1. Verifier attests fail, or poster challenges within a window.
2. Covenant enters **Disputed**.
3. Resolution policy runs (single verifier, panel, or timeout default).
4. Outcome: **release**, **slash**, or **split**.

## Packages

- `packages/protocol` — simulator, sqlite store, KasBonds harness, OpenSilver bridge, keys, P2SH derive
- `packages/sdk` — thin client wrappers
- `packages/verifier` — human + model-as-judge **stubs** (off-chain attest helpers)
- `apps/cli` — `bonded` CLI

## Docs

- [Protocol sketch](docs/protocol.md)
- [Fee model](docs/fees.md)
- [MVP scope](docs/mvp.md) · [MVP status](docs/mvp-status.md)
- [CLI](docs/cli.md) · [Keys](docs/keys.md)
- [Covenant adapter](docs/covenant-adapter.md)
- [KasBonds harness](docs/kasbonds-harness.md)
- [OpenSilver deploy-plan](docs/opensilver-deploy.md)
- [Verifier stubs](docs/verifier.md)

## Related

Compose later: **KasBonds** (bond rail), **OpenSilver** (escrow patterns), **clawdmarket** (discovery), **KasGraph** (indexing).

## Non-goals (for now)

- Full agent discovery marketplace
- Cross-chain bridges
- Live mainnet from this scaffold
- Guaranteeing model-judge honesty without cryptoeconomic risk

## License

MIT
