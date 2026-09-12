import { createSimulator } from "./simulator.js";
import { openSqliteStore } from "./store.js";

/**
 * Simulator backed by SQLite. Mutations write through to the store.
 */
export async function createPersistedSimulator({ dbPath, feeBps, now } = {}) {
  const store = await openSqliteStore(dbPath);
  const mem = createSimulator({ feeBps, now });

  // hydrate
  for (const job of store.loadAll()) {
    // re-open via internal map by replaying into memory through a private channel:
    // simplest: use mem's openJob only for new; for hydrate poke via list injection
    hydrateJob(mem, job);
  }

  function wrap(method) {
    return (...args) => {
      const result = mem[method](...args);
      if (result?.jobId) store.upsert(result);
      return result;
    };
  }

  return {
    feeBps: mem.feeBps,
    store,
    list: () => mem.list(),
    get: (id) => mem.get(id),
    openJob: wrap("openJob"),
    claim: wrap("claim"),
    submit: wrap("submit"),
    attest: wrap("attest"),
    expire: wrap("expire"),
    recordChainLock: wrap("recordChainLock"),
    async reload() {
      // re-read disk into a fresh simulator would require recreate; for tests use get from store
      return store.loadAll();
    },
    close: () => store.close(),
  };
}

/** Inject a previously persisted job into the in-memory simulator. */
function hydrateJob(mem, job) {
  // Access is closed; recreate by open+force via undocumented path:
  // We extend simulator with _hydrate in simulator.js instead.
  if (typeof mem._hydrate === "function") {
    mem._hydrate(job);
    return;
  }
  throw new Error("simulator missing _hydrate");
}
