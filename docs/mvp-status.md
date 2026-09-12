# MVP status

## Done

- Simulator + SQLite persistence + covenant adapter
- **KasBonds harness bridge** (flag-gated): plans/spawns `lock-bond` / `release-proof` / `slash-proof` with DRY_RUN by default
- Docs: `docs/kasbonds-harness.md`

## Next

1. After a dry-run spawn against a real KasBonds checkout, persist `BOND_LOCK_TXID` back onto the job
2. Optional OpenSilver `deploy-plan` for escrow leg
3. Arg CLI
