# Escrow key material

```bash
node apps/cli/bonded.js keys generate --out ./data/escrow-keys.json
```

Produces secp256k1 keypairs (compressed pubkeys) for buyer / seller / arbiter and
`ctorArgs` suitable for OpenSilver `core.escrow-bilateral` (arbiter slot = blake2b-256(pubkey)).

```bash
# plan with freshly generated keys (also writes --keys-out if set)
node apps/cli/bonded.js plan-escrow --ksb --job job_1 --generate-keys --keys-out ./data/escrow-keys.json

# plan with explicit pubkeys
node apps/cli/bonded.js plan-escrow --db ./data/jobs.sqlite --job job_1 \
  --buyer-pub 02… --seller-pub 03… --arbiter-pub 02…
```

Never commit private keys.
