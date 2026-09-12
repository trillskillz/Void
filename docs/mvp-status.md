# MVP status

## Done

- Local stack: simulator, sqlite, KasBonds/OpenSilver bridges, arg CLI
- Wallet key helpers (secp256k1 + blake2b arbiter hash)
- Real dry-runs: KasBonds lock write-back, OpenSilver deploy-plan + P2SH address
- `demo:compose` / `bonded compose` + `--db --ksb` journal persistence
- Verifier package stubs (human + model)
- CLI `attest --policy human|model-stub`
- GitHub Actions `test` workflow

## Next

1. Funded TN12 live lock behind explicit `BONDED_WORK_CHAIN_LIVE=1`
2. Indexer / KasGraph hooks (later)
