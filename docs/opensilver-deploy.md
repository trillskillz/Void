# OpenSilver escrow deploy-plan bridge

Builds an OpenSilver **deploy-plan** for the job escrow leg (default `core.escrow-bilateral`).

## Safety

| Flag | Meaning |
|---|---|
| *(unset)* | Plan only — prints the `npx opensilver deploy-plan …` command |
| `BONDED_WORK_OPENSILVER=1` | Allow execute |
| `OPENSILVER_ROOT` | Path to an OpenSilver checkout |
| `OPENSILVER_NETWORK` | default `kaspa:testnet-12` |

Ctor args in the planner are **stubs derived from job ids** (not funded keys). Replace with real buyer/seller pubkeys + arbiter blake2b hash before any funding.

## Demo

```bash
npm run demo:opensilver
```

## Composition with KasBonds

1. OpenSilver deploy-plan → escrow P2SH commitment (optional for tiny jobs)
2. KasBonds lock-bond → service bond / slash rail (required for cold agents)

See `docs/covenant-adapter.md`.
