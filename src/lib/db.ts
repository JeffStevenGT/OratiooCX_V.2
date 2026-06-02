/**
 * lib/db.ts — Pool de Conexiones PostgreSQL
 * ============================================
 * Máximo 20 conexiones simultáneas.
 * Queries lentas se matan a los 30s.
 * Conexiones inactivas se cierran a los 30s.
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
});

export default pool;

// Helper para queries tipadas
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

// Helper para transacciones
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
