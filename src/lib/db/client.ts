import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

/**
 * Uses Node's own built-in SQLite (available since Node 22.5+, no flag
 * needed as of the Node versions this was tested against — you'll see an
 * "ExperimentalWarning: SQLite is an experimental feature" printed once at
 * startup; that's expected and harmless, not an error).
 *
 * This replaced better-sqlite3, which requires compiling a native C++
 * addon via node-gyp. That's a common source of setup friction on Windows
 * specifically — it needs a correctly configured Visual Studio Build Tools
 * installation with a matching Windows SDK version, and a mismatch
 * (exactly the "Windows SDK version ... was not found" error) is a very
 * common failure mode that has nothing to do with this project's code.
 * node:sqlite ships inside Node itself, so there's nothing to compile on
 * any platform — this is what makes `npm install` work the same way on
 * Windows, Mac, and Linux without a build toolchain.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "claimops.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __claimops_db?: DatabaseSync };

function createConnection(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  const schema = fs.readFileSync(path.join(process.cwd(), "src/lib/db/schema.sql"), "utf-8");
  db.exec(schema);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__claimops_db) {
    globalForDb.__claimops_db = createConnection();
  }
  return globalForDb.__claimops_db;
}
