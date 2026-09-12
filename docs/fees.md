# Fee model (hypothetical defaults)

All numbers are **defaults for discussion**, not promises or market data.

## Take rate on release

- **Default:** `300 bps` (3%) of `escrow_amount` on successful `Released`.
- **Range to test:** 200–500 bps.
- **Paid by:** effectively the worker (skimmed from escrow before payout). Terms may allow poster-gross-up later; MVP skims from escrow only.

## Bond

- Bond is separate from escrow.
- **Who posts:** poster by default; optional worker co-bond for high-trust claims.
- Bond returns on `Released` / clean `Expired` per terms.
- Bond is the primary slash surface on `fail` / fraud.

## Bond insurance (optional add-on)

Hypothesis: a premium (`insurance_bps` of bond or flat fee) buys:

- higher max job size, or
- access to panel verifiers, or
- faster challenge resolution SLA

Premium accrues to protocol (or a ring-fenced insurance pool in a later version). **Not in MVP code path** — document-only until volume exists.

## Verifier tiers

| Tier | Who | Price (hypothesis) | Use |
|---|---|---|---|
| Self | poster attests | 0 | tiny / trusted pairs |
| Named model | single model judge | small flat or % | checklist jobs |
| Human | named human | higher flat | subjective / high value |
| Panel | M-of-N | highest | disputes / large escrow |

Verifier fees can be:

- paid up front by poster into escrow as `verifier_budget`, or
- deducted from protocol take (subsidy — avoid in MVP)

**MVP:** named single verifier; panel only as manual ops if needed.

## Slash / split routing

Hypothetical defaults:

- `Slashed`: 100% worker bond → treasury (or burn if governance prefers); escrow → poster
- `Split`: after fee, 50/50 escrow; bonds returned or partially slashed per severity flag in attestation
- `Expired` before claim: full refund poster, no fee
- `Expired` after claim with no submit: worker bond slashed (partial), escrow → poster

## What we will not claim

- No projected ARR, take-rate, or user counts in marketing copy until measured.
- No “risk-free” verifier. Fees do not buy certainty; they buy a process.
