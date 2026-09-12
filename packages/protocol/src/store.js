import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import initSqlJs from "sql.js";

/**
 * SQLite job store (sql.js / wasm — no native build).
 * Schema: jobs(job_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER)
 */
export async function openSqliteStore(dbPath) {
  const SQL = await initSqlJs();
  let db;
  if (dbPath && existsSync(dbPath)) {
    db = new SQL.Database(readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `);

  function persistToDisk() {
    if (!dbPath) return;
    mkdirSync(dirname(dbPath), { recursive: true });
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
  }

  return {
    dbPath,
    loadAll() {
      const res = db.exec("SELECT json FROM jobs");
      if (!res.length) return [];
      return res[0].values.map(([json]) => JSON.parse(json));
    },
    upsert(job) {
      db.run(
        `INSERT INTO jobs (job_id, json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(job_id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at`,
        [job.jobId, JSON.stringify(job), job.updatedAt || Date.now()]
      );
      persistToDisk();
    },
    get(jobId) {
      const stmt = db.prepare("SELECT json FROM jobs WHERE job_id = ?");
      stmt.bind([jobId]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return JSON.parse(row.json);
      }
      stmt.free();
      return null;
    },
    getKv(key) {
      const stmt = db.prepare("SELECT json FROM kv WHERE key = ?");
      stmt.bind([key]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return JSON.parse(row.json);
      }
      stmt.free();
      return null;
    },
    setKv(key, value) {
      db.run(
        `INSERT INTO kv (key, json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET json=excluded.json`,
        [key, JSON.stringify(value)]
      );
      persistToDisk();
    },
    clear() {
      db.run("DELETE FROM jobs");
      db.run("DELETE FROM kv");
      persistToDisk();
    },
    close() {
      persistToDisk();
      db.close();
    },
  };
}
