# MVP status

## Done

- In-memory simulator + SQLite persistence (`sql.js`)
- SDK + verifier stub + CLI demos
- **Covenant adapter spike:** Bonded Work ↔ KasBonds lifecycle map, OpenSilver pattern picks, `createKsbStubBackend` journal of intended lock/release/slash (no chain broadcast yet)
- Docs: `docs/covenant-adapter.md`

## Next

1. Hook journal actions to KasBonds TN12 scripts (`lock-bond` / `release-proof` / `slash-proof`) behind a feature flag
2. Optional: compile-plan against OpenSilver escrow pattern via `opensilver deploy-plan`
3. CLI with args
