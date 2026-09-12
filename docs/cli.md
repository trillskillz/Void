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
