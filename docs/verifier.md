# Verifier stubs

Off-chain helpers in `packages/verifier`. They produce attest payloads; the simulator/CLI still calls `attest(jobId, verifierId, verdict, …)`.

```bash
npm run demo:verifier
```

- `createHumanVerifier` — requires an explicit `{ verdict: "pass"|"fail" }`
- `createModelStubVerifier` — checklist over `artifact.contentHash` / `uri` (no real model call)

Replace the model stub’s `attest` with a real judge when you have one. Live chain release still goes through KasBonds harness flags.
