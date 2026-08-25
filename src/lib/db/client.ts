import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Real file on disk. This is what makes persistence actually real when you
// run `npm run dev` — not an in-memory array that resets on refresh.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "claimops.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Next.js dev mode reloads modules on file changes; cache the connection on
// globalThis so we don't reopen the file on every hot reload.
const globalForDb = globalThis as unknown as { __claimops_db?: Database.Database };

function createConnection(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__claimops_db) {
    globalForDb.__claimops_db = createConnection();
  }
  return globalForDb.__claimops_db;
}
