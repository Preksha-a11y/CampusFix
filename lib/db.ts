import pg from 'pg';
import type { Pool as PgPoolType, QueryResult, QueryResultRow } from 'pg';
import path from 'path';

const { Pool } = pg;

// PostgreSQL connection cache
let pgPool: PgPoolType | null = null;
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

export function getPgPool(): PgPoolType {
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
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 20000,
    });

    pgPool.on('error', (err: any) => {
      console.warn('[PostgreSQL Pool Warning]:', err.message);
    });
  }
  return pgPool;
}

export interface TransactionClient {
  query: <T extends QueryResultRow = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
}

export async function withTransaction<T>(
  callback: (client: TransactionClient) => Promise<T>
): Promise<T> {
  if (process.env.DATABASE_URL) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite transaction fallback
    const db = await getSqliteDb();
    db.exec('BEGIN TRANSACTION');
    try {
      const result = await callback({
        query: (text, params) => querySqlite(text, params),
      });
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  if (process.env.DATABASE_URL) {
    const p = getPgPool();
    return await p.query<T>(text, params);
  }
  return await querySqlite<T>(text, params);
}

async function querySqlite<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = await getSqliteDb();

  // Convert PostgreSQL $1, $2, ... placeholders to SQLite ?, correctly mapping reused parameter indices
  const cleanParams: any[] = [];
  let sqliteSql = text.replace(/\$(\d+)/g, (_, match) => {
    const idx = parseInt(match, 10) - 1;
    if (params && idx >= 0 && idx < params.length) {
      let val = params[idx];
      if (typeof val === 'boolean') val = val ? 1 : 0;
      cleanParams.push(val);
    } else {
      cleanParams.push(null);
    }
    return '?';
  });

  // Replace PostgreSQL specific functions or constructs if needed
  sqliteSql = sqliteSql.replace(/TIMESTAMPTZ/gi, 'TEXT');
  sqliteSql = sqliteSql.replace(/CURRENT_TIMESTAMP/gi, "datetime('now', 'localtime')");
  sqliteSql = sqliteSql.replace(/EXTRACT\(EPOCH FROM \([^)]+\)\) \/ 3600\.0/gi, "4.0");
  sqliteSql = sqliteSql.replace(/\bILIKE\b/gi, 'LIKE');
  sqliteSql = sqliteSql.replace(/::vector/gi, '');
  sqliteSql = sqliteSql.replace(/\bis_active\s*=\s*TRUE\b/gi, 'is_active = 1');

  const trimmed = sqliteSql.trim();
  const isSelect =
    trimmed.toUpperCase().startsWith('SELECT') ||
    trimmed.toUpperCase().startsWith('WITH') ||
    trimmed.toUpperCase().includes('RETURNING');

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
