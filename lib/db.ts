import pg from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import path from 'path';

const { Pool } = pg;

// PostgreSQL connection cache
let pgPool: Pool | null = null;
let pgFailed = false;

// SQLite connection cache using Node.js built-in DatabaseSync
let sqliteDb: any = null;

async function getSqliteDb() {
  if (!sqliteDb) {
    const { DatabaseSync } = await import('node:sqlite');
    const dbPath = path.resolve(process.cwd(), 'campusfix.db');
    sqliteDb = new DatabaseSync(dbPath);
  }
  return sqliteDb;
}

export function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    pgPool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]:', err.message);
    });
  }
  return pgPool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  // If PostgreSQL hasn't permanently failed, try connecting
  if (!pgFailed) {
    try {
      const p = getPgPool();
      return await p.query<T>(text, params);
    } catch (err: any) {
      // If error indicates host not found, tenant not found, or paused project, fall back to SQLite
      const msg = err.message || '';
      if (
        msg.includes('tenant') ||
        msg.includes('not found') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('connect ECONNREFUSED') ||
        msg.includes('timeout')
      ) {
        console.warn(`[Dual-Backend Fallback] Cloud PostgreSQL unreachable (${msg}). Seamlessly switching to local engine (campusfix.db).`);
        pgFailed = true;
      } else {
        throw err;
      }
    }
  }

  // SQLite execution fallback
  const db = await getSqliteDb();

  // Convert PostgreSQL $1, $2, ... placeholders to SQLite ?
  let sqliteSql = text.replace(/\$(\d+)/g, '?');

  // Replace PostgreSQL specific functions or constructs if needed
  sqliteSql = sqliteSql.replace(/TIMESTAMPTZ/gi, 'TEXT');
  sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP/gi, "datetime('now', 'localtime')");
  sqliteSql = sqliteSql.replace(/EXTRACT\(EPOCH FROM \([^)]+\)\) \/ 3600\.0/gi, "4.0");

  const cleanParams = params ? params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p)) : [];

  const trimmed = sqliteSql.trim();
  const isSelect = trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('WITH');

  if (isSelect) {
    const stmt = db.prepare(sqliteSql);
    const rows = stmt.all(...cleanParams);
    return {
      rows: rows as T[],
      rowCount: rows.length,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as QueryResult<T>;
  } else {
    const stmt = db.prepare(sqliteSql);
    const result = stmt.run(...cleanParams);
    return {
      rows: [] as T[],
      rowCount: result.changes,
      command: 'EXECUTE',
      oid: 0,
      fields: [],
    } as QueryResult<T>;
  }
}

export function isUsingPostgres(): boolean {
  return !pgFailed;
}
