#!/usr/bin/env node
/**
 * Bonded Work CLI
 *
 * Usage:
 *   node apps/cli/bonded.js <command> [flags]
 *
 * Backends:
 *   (default) in-memory simulator for the process
 *   --db <path>     SQLite-persisted simulator
 *   --ksb           KasBonds stub backend (journal of intended chain actions)
 *
 * Commands:
 *   open    --poster <id> --escrow <n> [--bond <n>] [--verifier <id>] [--job <id>]
 *   claim   --job <id> --worker <id>
 *   submit  --job <id> --worker <id> --hash <contentHash> [--uri <uri>]
 *   attest  --job <id> --verifier <id> [--policy human|model-stub] [--verdict pass|fail] [--evidence <ref>]
 *   expire  --job <id>
 *   get     --job <id>
 *   list
 *   journal                 (ksb backend only)
 *   plan-chain              plan KasBonds harness steps from journal
 *   plan-escrow --job <id>  plan OpenSilver deploy-plan for escrow leg
 *   compose  --job <id>     execute escrow plan + lock (env-gated; use --db --ksb)
 *   help
 */

import {
  createClient,
  createPersistedClient,
  createPersistedKsbClient,
  createKsbStubClient,
  processJournal,
  processEscrowDeploy,
} from "../../packages/sdk/src/index.js";
import { generateEscrowPartyKeys, generateSecp256k1Keypair, bilateralEscrowCtorArgs } from "../../packages/protocol/src/keys.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHumanVerifier, createModelStubVerifier } from "../../packages/verifier/src/index.js";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage(code = 0) {
  const text = `bonded — Bonded Work CLI

Usage:
  node apps/cli/bonded.js <command> [flags]

Flags (global):
  --db <path>     persist jobs in sqlite (sql.js)
  --ksb           use KasBonds stub backend (enables journal)
  --db + --ksb    persisted KSB (journal + chain meta survive reopen)

Commands:
  open    --poster <id> --escrow <n> [--bond <n>] [--verifier <id>] [--job <id>]
  claim   --job <id> --worker <id>
  submit  --job <id> --worker <id> --hash <contentHash> [--uri <uri>]
  attest  --job <id> --verifier <id> [--policy human|model-stub] [--verdict pass|fail] [--evidence <ref>]
  expire  --job <id>
  get     --job <id>
  list
  journal
  plan-chain
  plan-escrow --job <id>
  compose --job <id>   run OpenSilver deploy-plan + KasBonds lock (env-gated)
  help
`;
  process.stdout.write(text);
  process.exit(code);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requireFlag(args, name) {
  if (args[name] == null || args[name] === true) {
    throw new Error(`missing --${name}`);
  }
  return args[name];
}

async function makeClient(args) {
  if (args.db && args.ksb) {
    return createPersistedKsbClient({ dbPath: args.db });
  }
  if (args.db) {
    return createPersistedClient({ dbPath: args.db });
  }
  if (args.ksb) {
    return createKsbStubClient();
  }
  return createClient();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";
  if (cmd === "help" || args.help) usage(0);

  const client = await makeClient(args);

  try {
    switch (cmd) {
      case "open": {
        const job = client.openJob({
          poster: requireFlag(args, "poster"),
          escrowAmount: Number(requireFlag(args, "escrow")),
          bondAmount: Number(args.bond ?? 0),
          verifierId: args.verifier || "verifier:default",
          jobId: args.job,
        });
        printJson(job);
        break;
      }
      case "claim": {
        printJson(client.claim(requireFlag(args, "job"), requireFlag(args, "worker")));
        break;
      }
      case "submit": {
        printJson(
          client.submit(requireFlag(args, "job"), requireFlag(args, "worker"), {
            contentHash: requireFlag(args, "hash"),
            uri: args.uri || null,
          })
        );
        break;
      }
      case "attest": {
        const jobId = requireFlag(args, "job");
        const verifierId = requireFlag(args, "verifier");
        const policy = args.policy || "human";
        const job = client.get(jobId);
        if (!job) throw new Error(`job not found: ${jobId}`);

        let verdict = args.verdict;
        let evidence = args.evidence || null;
        let policyAttest = null;

        if (policy === "model-stub") {
          const model = createModelStubVerifier({ verifierId });
          policyAttest = model.attest({ jobId, artifact: job.artifact || {} });
          if (verdict == null || verdict === true) verdict = policyAttest.verdict;
          if (!evidence) evidence = policyAttest.evidenceRef;
        } else if (policy === "human") {
          if (verdict == null || verdict === true) {
            throw new Error("human policy requires --verdict pass|fail");
          }
          const human = createHumanVerifier({ verifierId });
          policyAttest = human.attest(
            { jobId, artifact: job.artifact || {} },
            { verdict, evidenceRef: evidence, note: args.note || null }
          );
          evidence = evidence || policyAttest.evidenceRef;
        } else {
          throw new Error("--policy must be human|model-stub");
        }

        if (verdict !== "pass" && verdict !== "fail") throw new Error("--verdict must be pass|fail");
        const done = client.attest(jobId, verifierId, verdict, evidence);
        printJson({ job: done, policy, policyAttest });
        break;
      }
      case "expire": {
        printJson(client.expire(requireFlag(args, "job")));
        break;
      }
      case "get": {
        printJson(client.get(requireFlag(args, "job")));
        break;
      }
      case "list": {
        printJson(client.list());
        break;
      }
      case "journal": {
        printJson(client.journal());
        break;
      }
      case "plan-chain": {
        const results = await processJournal(client.journal(), {
          execute: false,
          backend: client.backend,
        });
        printJson(results);
        break;
      }
      case "plan-escrow": {
        const job = client.get(requireFlag(args, "job"));
        const deployOpts = { execute: false, backend: client.backend };
        if (args["generate-keys"]) {
          const generated = generateEscrowPartyKeys();
          deployOpts.ctor = generated.ctorArgs;
          if (args["keys-out"]) {
            mkdirSync(dirname(args["keys-out"]), { recursive: true });
            writeFileSync(args["keys-out"], JSON.stringify(generated, null, 2));
          }
          const plan = await processEscrowDeploy(job, deployOpts);
          printJson({ plan, keysWritten: args["keys-out"] || null, warning: generated.warning });
          break;
        }
        if (args["buyer-pub"] && args["seller-pub"] && args["arbiter-pub"]) {
          deployOpts.ctor = bilateralEscrowCtorArgs({
            buyerPubKeyHex: args["buyer-pub"],
            sellerPubKeyHex: args["seller-pub"],
            arbiterPubKeyHex: args["arbiter-pub"],
          });
        }
        const plan = await processEscrowDeploy(job, deployOpts);
        printJson(plan);
        break;
      }

      case "compose": {
        const jobId = requireFlag(args, "job");
        const job = client.get(jobId);
        if (!job) throw new Error(`job not found: ${jobId}`);
        if (!client.journal().length) {
          throw new Error("compose needs a KSB backend (--ksb or --db --ksb) with a journal");
        }
        const out = { jobId, escrow: null, lock: null, chain: null };
        const osOn = process.env.BONDED_WORK_OPENSILVER === "1";
        const chainOn = process.env.BONDED_WORK_CHAIN === "1";
        if (osOn) {
          mkdirSync(process.env.BONDED_WORK_OPENSILVER_OUT || "./data/opensilver-plans", {
            recursive: true,
          });
          out.escrow = await processEscrowDeploy(client.get(jobId), {
            execute: true,
            backend: client.backend,
            env: process.env,
          });
        } else {
          out.escrow = await processEscrowDeploy(client.get(jobId), {
            execute: false,
            backend: client.backend,
            env: process.env,
          });
          out.escrow = { ...out.escrow, note: "set BONDED_WORK_OPENSILVER=1 to execute" };
        }
        const lockEntry = client.journal().find((e) => e.action === "lock_bond" && e.jobId === jobId);
        if (chainOn && lockEntry) {
          const results = await processJournal([lockEntry], {
            execute: true,
            backend: client.backend,
            env: process.env,
          });
          out.lock = results[0];
        } else if (lockEntry) {
          const results = await processJournal([lockEntry], {
            execute: false,
            backend: client.backend,
            env: process.env,
          });
          out.lock = { ...results[0], note: "set BONDED_WORK_CHAIN=1 to execute" };
        } else {
          out.lock = { skipped: true, reason: "no lock_bond journal entry for job" };
        }
        out.chain = client.get(jobId).chain;
        printJson(out);
        break;
      }
      case "keys": {
        const sub = args._[1] || "generate";
        if (sub !== "generate") throw new Error("usage: keys generate [--out file]");
        const generated = generateEscrowPartyKeys();
        if (args.out) {
          mkdirSync(dirname(args.out), { recursive: true });
          writeFileSync(args.out, JSON.stringify(generated, null, 2));
        }
        printJson(generated);
        break;
      }
      default:
        throw new Error(`unknown command: ${cmd}`);
    }
  } finally {
    client.close?.();
  }
}

main().catch((err) => {
  process.stderr.write(`bonded: ${err.message}\n`);
  process.exit(1);
});
