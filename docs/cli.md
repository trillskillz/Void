# Bonded Work CLI

```bash
node apps/cli/bonded.js help
# or after npm link / package bin:
# bonded help
```

## Examples

```bash
# persisted happy path
node apps/cli/bonded.js open --db ./data/jobs.sqlite --poster agent:p --escrow 1000 --bond 100 --verifier v1 --job job_1
node apps/cli/bonded.js claim --db ./data/jobs.sqlite --job job_1 --worker agent:w
node apps/cli/bonded.js submit --db ./data/jobs.sqlite --job job_1 --worker agent:w --hash sha256:abc
node apps/cli/bonded.js attest --db ./data/jobs.sqlite --job job_1 --verifier v1 --verdict pass

# KasBonds stub journal planning (in-process flags; use --ksb)
node apps/cli/bonded.js open --ksb --poster p --escrow 10 --bond 1 --job j
node apps/cli/bonded.js claim --ksb --job j --worker w
# note: --ksb without --db is per-process memory; prefer --db for multi-invoke
```

For multi-step without sqlite, chain in one shell session isn't preserved across invocations — use `--db`.

## Compose demo (both legs)

```bash
BONDED_WORK_OPENSILVER=1 OPENSILVER_ROOT=/path/to/OpenSilver \
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/path/to/KasBonds \
  npm run demo:compose
```

Writes `job.chain.escrow` (incl. `escrowAddress` when kaspa-wasm resolves) and dry-run `job.chain.lockTxid`.

## Compose via CLI (persisted)

```bash
node apps/cli/bonded.js open --db ./data/jobs.sqlite --ksb \
  --poster agent:p --escrow 1000 --bond 100 --verifier oracle:ksb --job job_1
node apps/cli/bonded.js claim --db ./data/jobs.sqlite --ksb --job job_1 --worker agent:w

BONDED_WORK_OPENSILVER=1 OPENSILVER_ROOT=/path/to/OpenSilver \
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/path/to/KasBonds \
  node apps/cli/bonded.js compose --db ./data/jobs.sqlite --ksb --job job_1

node apps/cli/bonded.js get --db ./data/jobs.sqlite --ksb --job job_1
```

`--db --ksb` persists jobs, `job.chain`, and the KSB journal in sqlite across process restarts.

## Attest with verifier policy

```bash
# model stub derives pass/fail from job.artifact.contentHash
node apps/cli/bonded.js attest --db ./data/jobs.sqlite --ksb \
  --job job_1 --verifier verifier:model-stub --policy model-stub

# human still requires an explicit verdict
node apps/cli/bonded.js attest --db ./data/jobs.sqlite --ksb \
  --job job_1 --verifier verifier:human --policy human --verdict pass
```

## Settle (release / slash)

After `attest`, the KSB journal has a `release` or `slash` entry. Plan (default) or dry-run spawn:

```bash
# plan only
node apps/cli/bonded.js settle --db ./data/jobs.sqlite --ksb --job job_1

# dry-run KasBonds release/slash (needs KASBONDS_ROOT; still DRY_RUN unless LIVE)
BONDED_WORK_CHAIN=1 KASBONDS_ROOT=/path/to/KasBonds \
  node apps/cli/bonded.js settle --db ./data/jobs.sqlite --ksb --job job_1
```

Release/slash still need a real covenant UTXO for a successful script dry-run when pointing at a dry-run lock txid — planning always works.
