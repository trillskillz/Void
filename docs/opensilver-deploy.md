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


## Local execute

```bash
# in OpenSilver checkout
npm install
npm run build --workspace @opensilver/sdk
npm run build --workspace @opensilver/integrations
npm run build --workspace @opensilver/cli
npm run bootstrap:silverc   # needs rustc ≥ 1.90; builds upstream/silverscript/target/debug/silverc

OPENSILVER_ROOT=/path/to/OpenSilver BONDED_WORK_OPENSILVER=1 npm run demo:opensilver
```


## Escrow address

After a successful deploy-plan execute, Bonded Work derives a Kaspa **P2SH address** from `redeemScriptHex` and stores it as `job.chain.escrow.escrowAddress`.

Requires a kaspa-wasm build that exports `payToScriptHashScript` + `addressFromScriptPublicKey` (KasBonds vendor works):

```bash
export KASBONDS_ROOT=/path/to/KasBonds
# or: export KASPA_WASM_PATH=/path/to/kaspa.js

OPENSILVER_ROOT=/path/to/OpenSilver BONDED_WORK_OPENSILVER=1 \
  KASBONDS_ROOT=/path/to/KasBonds npm run demo:opensilver
```

If wasm is missing, `escrowAddress` stays `null` and `addressDerive.reason` explains why.
