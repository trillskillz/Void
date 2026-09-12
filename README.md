# Bonded Work

Kaspa-native **covenant escrow for agent-to-agent jobs**.

An agent posts work and a bond. Another agent claims it. Funds lock in a covenant. Release happens only when a verifier attests the outcome. Disputes slash or split the bond.

This repo is the product sketch + scaffold — not a live protocol yet.

## Problem

Agents already hire each other (compute, tools, scrapers, codegen). Trust is still theater: screenshots, reputation scores, hope. Cold agents cannot trade large jobs without a settlement rail that can **lock, release, and slash**.

## Why now

- Covenant / KIP-20 patterns are becoming usable (see OpenSilver-style libraries).
- Agent marketplaces exist (discovery) but settlement is off-protocol.
- Model-as-judge is good enough for many binary or checklist outcomes — and humans can still attest hard cases.

## How it works

### Happy path

1. **Poster** opens a job with escrow + bond terms and a verifier policy.
2. **Worker** claims the job; covenant locks funds.
3. Worker **submits** an artifact / proof pointer.
4. **Verifier** attests pass → covenant **releases** escrow to worker (minus protocol fee).
5. Bond returns to poster (or stays posted for the next job, depending on terms).

### Dispute path

1. Verifier attests fail, or poster challenges within a window.
2. Covenant enters **Disputed**.
3. Resolution policy runs (single verifier, panel, or timeout default).
4. Outcome: **release**, **slash** (burn / protocol treasury), or **split**.

## Differentiation

| Layer | Typical marketplace | Bonded Work |
|---|---|---|
| Discovery | yes | out of scope for MVP (bring your own matcher) |
| Settlement | invoice / IOU / trust | on-chain lock + release/slash |
| Failure | block / ghost | explicit slash / split |

Related owner work to compose later: **KasBonds** (bond primitive), **OpenSilver** (covenant patterns), **clawdmarket** (agent marketplace), **KasGraph** (indexing).

## Business model (hypothesis)

Not traction — defaults to pressure-test:

- **Take rate:** 2–5% of escrow on successful release.
- **Bond insurance (optional):** poster or worker pays a premium for higher bond / faster release tiers.
- **Verifier tiers:** free self-verify for tiny jobs; paid human or panel for high-value jobs.

Cold-start bet: power users bonding large recurring jobs; later verifier subscriptions.

## MVP (summary)

See [docs/mvp.md](docs/mvp.md). Short version: one covenant template, one TS SDK, one verifier adapter (human + model stub), no full marketplace UI.

## Docs

- [Protocol sketch](docs/protocol.md)
- [Fee model](docs/fees.md)
- [MVP scope](docs/mvp.md)

## Packages (stubs)

- `packages/protocol` — future covenant / tx helpers
- `packages/sdk` — TS client: post, claim, submit, attest, release
- `packages/verifier` — human + model-as-judge attest service

## Non-goals (for now)

- Full agent discovery marketplace
- Cross-chain bridges
- Live mainnet deployment from this scaffold
- Guaranteeing model-judge honesty without cryptoeconomic risk

## License

MIT

## Runnable simulator (MVP)

```bash
npm test
npm run demo:happy
npm run demo:fail
```

See [docs/mvp-status.md](docs/mvp-status.md). The simulator is **not** on-chain.

### Persistence

```bash
npm install
npm run demo:persist
```

Jobs land in `./data/demo-jobs.sqlite` (sql.js wasm SQLite).

### Covenant adapter (spike)

Maps product states onto **KasBonds** lifecycle + **OpenSilver** escrow patterns. Journals intended lock/release/slash — does **not** broadcast TN12 txs from this repo.

```bash
npm run demo:covenant
```

See [docs/covenant-adapter.md](docs/covenant-adapter.md).

### KasBonds harness (flag-gated)

```bash
npm run demo:harness
# optional dry-run spawn:
# KASBONDS_ROOT=/path/to/KasBonds BONDED_WORK_CHAIN=1 npm run demo:harness
```

See [docs/kasbonds-harness.md](docs/kasbonds-harness.md). Live broadcast requires `BONDED_WORK_CHAIN_LIVE=1` (off by default).

### Lock txid write-back

```bash
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/tmp/fake-kasbonds npm run demo:lock-txid
```

### OpenSilver escrow deploy-plan

```bash
npm run demo:opensilver
# execute against a checkout:
# BONDED_WORK_OPENSILVER=1 OPENSILVER_ROOT=/path/to/OpenSilver npm run demo:opensilver
```

See [docs/opensilver-deploy.md](docs/opensilver-deploy.md).

## CLI

```bash
node apps/cli/bonded.js help
node apps/cli/bonded.js open --db ./data/jobs.sqlite --poster agent:p --escrow 1000 --bond 100 --job job_1
```

See [docs/cli.md](docs/cli.md).
