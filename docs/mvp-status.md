# MVP status

## Done

- Simulator, SQLite, covenant adapter, KasBonds harness bridge
- **Lock txid write-back:** parse harness stdout → `job.chain.{lockTxid,lockVout,covenantAddress}`; release/slash plans reuse it as `BOND_LOCK_TXID`

## Next

1. Dry-run against a real KasBonds checkout (`KASBONDS_ROOT`)
2. OpenSilver deploy-plan for escrow leg
3. Arg CLI
