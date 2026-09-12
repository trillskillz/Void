# MVP scope (4–6 weeks)

## Goal

Prove one end-to-end **locked → submitted → attested → released/slashed** path on a Kaspa test environment (or simulated covenant runner if chain templates are not ready), with a thin TS SDK and a stub verifier.

## Must-have

1. One covenant **job template** matching the state machine in `docs/protocol.md` (even if first cut is a simulator behind the same API).
2. **SDK** methods: `openJob`, `claim`, `submit`, `attest`, `expire` (see `packages/sdk`).
3. **Verifier adapter**: human attest via CLI/API + model-judge stub that returns structured pass/fail + hash of rubric.
4. Minimal **indexing** story: append-only event log file or KasGraph note — enough to list jobs by id.
5. Docs stay truthful: mark simulator vs on-chain clearly.

## Out of scope

- Marketplace UI / discovery
- Reputation graphs
- Insurance pool
- Multi-verifier panels (except paper design)
- Mainnet launch
- Mobile apps

## Success metrics (qualitative)

- A stranger can read the README and explain the happy path in one minute.
- Two scripts (poster + worker) can complete a release against the simulator without manual DB edits.
- A forced fail path produces a slash outcome matching `docs/fees.md` defaults.
- No invented traction in the README.

## Suggested later layout

```
packages/
  protocol/   # covenant templates, encoding
  sdk/        # TS client
  verifier/   # attest services
apps/
  cli/        # poster/worker/verifier CLIs
docs/
```

## Sequencing

1. Simulator + SDK + CLI happy path
2. Fail/slash path + tests
3. Swap simulator backend for real covenant template when OpenSilver/KasBonds integration is ready
4. Optional: clawdmarket adapter as a discovery front-end (separate project)
