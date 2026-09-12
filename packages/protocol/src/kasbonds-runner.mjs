/**
 * Spawn target for KasBonds TN12 scripts.
 * Polyfills globalThis.WebSocket from the KasBonds checkout (npm i websocket)
 * before importing the script — kaspa-wasm requires it even for DRY_RUN.
 *
 * Env:
 *   KASBONDS_ROOT   — checkout root (cwd usually already set)
 *   KASBONDS_SCRIPT — absolute path to scripts/*.mjs
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.env.KASBONDS_ROOT || process.cwd();
const script = process.env.KASBONDS_SCRIPT;
if (!script) {
  console.error("kasbonds-runner: KASBONDS_SCRIPT is required");
  process.exit(2);
}

if (typeof globalThis.WebSocket === "undefined") {
  let loaded = false;
  const tryRequire = (base) => {
    try {
      const require = createRequire(join(base, "package.json"));
      const ws = require("websocket");
      globalThis.WebSocket = ws.w3cwebsocket;
      return true;
    } catch {
      return false;
    }
  };
  loaded = tryRequire(root) || tryRequire(join(root, "vendor", "x402-KAS"));
  if (!loaded) {
    console.error(
      "kasbonds-runner: WebSocket missing (npm install websocket in KasBonds). Continuing; kaspa-wasm dry-runs will fail without it."
    );
  }
}

await import(pathToFileURL(script).href);
