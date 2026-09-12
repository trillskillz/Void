# Protocol sketch

Informal. Implementable later. No chain code in this document is normative bytecode.

## Roles

| Role | Duty |
|---|---|
| **Poster** | Defines job, funds escrow, sets bond + verifier policy |
| **Worker** | Claims job, delivers artifact / proof |
| **Verifier** | Attests pass/fail (human, model, or panel) |
| **Protocol** | Covenant logic, fee skim, slash routing |

## State machine

```
Open
  → Locked          (worker claims; funds locked)
  → Submitted       (worker submits artifact pointer)
  → Released        (verifier pass; escrow to worker, fee skimmed)
  → Disputed        (fail attest or challenge)
       → Released | Slashed | Split
  → Expired         (claim or submit window elapsed; refund policy)
```

Terminal states: `Released`, `Slashed`, `Split`, `Expired`.

## Job terms (logical fields)

- `job_id`
- `poster`, `worker` (optional until claim)
- `escrow_amount`, `asset`
- `bond_amount`, `bond_payer` (poster | worker | both)
- `claim_deadline`, `submit_deadline`, `challenge_window`
- `verifier_policy`: `{ kind: self | named | panel, ids[], quorum }`
- `artifact_schema`: what counts as a submission (URI, hash, checklist)
- `fee_bps` (protocol take on release)

## Messages / actions

1. `open_job(terms, funding)` — creates covenant UTXO / covenant id in `Open`
2. `claim(job_id, worker)` — `Open → Locked`
3. `submit(job_id, artifact_ref, content_hash)` — `Locked → Submitted`
4. `attest(job_id, verdict, evidence_ref, sig)` — drives `Released` or `Disputed`
5. `challenge(job_id, reason)` — poster/worker challenge inside window → `Disputed`
6. `resolve(job_id, outcome)` — panel/timeout path from `Disputed`
7. `expire(job_id)` — permissionless after deadlines

Exact encoding (SilverScript / KIP-20 / script templates) is deferred to `packages/protocol`.

## Attestation format (logical)

```
attestation = {
  job_id,
  verdict: pass | fail,
  artifact_hash,
  evidence_ref?,          // optional notes / judge transcript URI
  verifier_id,
  issued_at,
  signature               // verifier key or multisig
}
```

Model-as-judge should hash the **rubric + artifact** it scored so disputes can re-run the same inputs.

## Fee hooks

On `Released`: skim `fee_bps` to protocol treasury; remainder to worker.
On `Slashed`: bond (and optionally escrow remainder) per terms — burn, treasury, or poster refund.
On `Split`: configurable weights in terms (default equal poster/worker after fee).

See [fees.md](fees.md).

## Trust assumptions (explicit)

- Verifier honesty is economic + reputational, not absolute.
- Artifact availability is the worker's problem (hash + content-addressed storage recommended).
- Kaspa reorg / confirmation policy is an implementation parameter, not solved here.
