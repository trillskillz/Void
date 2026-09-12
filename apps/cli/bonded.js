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
 *   attest  --job <id> --verifier <id> --verdict pass|fail [--evidence <ref>]
 *   expire  --job <id>
 *   get     --job <id>
 *   list
 *   journal                 (ksb backend only)
 *   plan-chain              plan KasBonds harness steps from journal
 *   plan-escrow --job <id>  plan OpenSilver deploy-plan for escrow leg
 *   help
 */

import { createClient, createPersistedClient, createKsbStubClient, processJournal, processEscrowDeploy } from "../../packages/sdk/src/index.js";

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

Commands:
  open    --poster <id> --escrow <n> [--bond <n>] [--verifier <id>] [--job <id>]
  claim   --job <id> --worker <id>
  submit  --job <id> --worker <id> --hash <contentHash> [--uri <uri>]
  attest  --job <id> --verifier <id> --verdict pass|fail [--evidence <ref>]
  expire  --job <id>
  get     --job <id>
  list
  journal
  plan-chain
  plan-escrow --job <id>
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
        const verdict = requireFlag(args, "verdict");
        if (verdict !== "pass" && verdict !== "fail") throw new Error("--verdict must be pass|fail");
        printJson(
          client.attest(
            requireFlag(args, "job"),
            requireFlag(args, "verifier"),
            verdict,
            args.evidence || null
          )
        );
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
        const plan = await processEscrowDeploy(job, {
          execute: false,
          backend: client.backend,
        });
        printJson(plan);
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
