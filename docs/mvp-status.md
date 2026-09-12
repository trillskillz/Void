# MVP status

## Done

- In-memory simulator (`packages/protocol`) with open → claim → submit → release/slash
- SDK wrapper (`packages/sdk`)
- Verifier stub (`packages/verifier`)
- CLI demos: `npm run demo:happy` / `npm run demo:fail`
- Protocol unit tests: `npm test`

## Next

1. Persist jobs (sqlite / json log)
2. Swap simulator for real covenant template when ready
3. CLI with args instead of fixed demos
