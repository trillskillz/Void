# MVP status

## Done

- In-memory simulator (`packages/protocol`) with open → claim → submit → release/slash
- **SQLite persistence** via `sql.js` (`createPersistedSimulator`, `npm run demo:persist`)
- SDK wrapper (`packages/sdk`) including `createPersistedClient`
- Verifier stub (`packages/verifier`)
- CLI demos: `demo:happy` / `demo:fail` / `demo:persist`
- Protocol unit tests: `npm test`

## Next

1. Swap simulator for real covenant template when ready
2. CLI with args instead of fixed demos
3. Optional: KasGraph / event indexer hook
