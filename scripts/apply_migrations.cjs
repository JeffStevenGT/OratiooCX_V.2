// scripts/apply_migrations.cjs
// Aplica migraciones .sql a la BD usando DATABASE_URL del .env (sin exponer credenciales).
// Seguridad: solo aplica si la BD es local (localhost/127.0.0.1) salvo que se pase --force.
// Uso: node scripts/apply_migrations.cjs migrations/003_ddis.sql migrations/004_ddis_seed.sql [--force]

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const root = path.resolve(__dirname, '..');

// --- cargar DATABASE_URL desde .env / .env.production sin volcarla a stdout ---
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(path.join(root, file), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim().replace(/^["']|["']$/g, '');
        process.env[m[1]] = v;
      }
    }
  } catch (_) {}
}
loadEnv('.env');
loadEnv('.env.production');

const url = process.env.DATABASE_URL;
if (!url) { console.error('ERROR: DATABASE_URL no encontrada en .env'); process.exit(2); }

let host = '?', port = '?', db = '?';
try {
  const u = new URL(url);
  host = u.hostname; port = u.port || '5432'; db = u.pathname.replace(/^\//, '');
} catch (_) {}

const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
const force = process.argv.includes('--force');
const files = process.argv.slice(2).filter(a => a.endsWith('.sql'));

console.log(`Destino BD -> host=${host} port=${port} db=${db} (local=${isLocal})`);
if (!files.length) { console.error('ERROR: indica al menos un archivo .sql'); process.exit(2); }
if (!isLocal && !force) {
  console.error('ABORTADO: la BD NO es local. Revisa el destino; usa --force solo si es intencional.');
  process.exit(3);
}

(async () => {
  const pool = new Pool({ connectionString: url });
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(root, f), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`OK  ${f}`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`FALLO ${f}: ${e.message}`);
        throw e;
      } finally {
        client.release();
      }
    }
    // Verificacion si la tabla ddis existe
    const chk = await pool.query(`SELECT to_regclass('public.ddis') AS t`);
    if (chk.rows[0].t) {
      const r = await pool.query(
        `SELECT estado, count(*)::int n, count(outbound_id)::int con_uuid
           FROM ddis GROUP BY estado ORDER BY estado`);
      const tot = await pool.query(`SELECT count(*)::int n, count(DISTINCT codigo_prov)::int provs FROM ddis`);
      console.log(`\nVerificacion ddis: ${tot.rows[0].n} filas, ${tot.rows[0].provs} provincias`);
      for (const row of r.rows) console.log(`  ${row.estado}: ${row.n} (con outbound_id: ${row.con_uuid})`);
    }
    console.log('\nMigraciones aplicadas correctamente.');
  } catch (e) {
    console.error('Proceso abortado por error.');
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
