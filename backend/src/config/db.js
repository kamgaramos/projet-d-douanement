const { Pool } = require('pg');

// Log pour le diagnostic : savoir quelle URL/params sont utilisées
// Railway fournit souvent soit DATABASE_URL, soit host/user/password/db/port.
const dbUrl = process.env.DATABASE_URL;

const hasRailwayParams = !!(
  process.env.PGHOST &&
  process.env.POSTGRES_USER &&
  process.env.POSTGRES_PASSWORD &&
  process.env.POSTGRES_DB
);

let poolConfig;

if (dbUrl) {
  poolConfig = { connectionString: dbUrl };
} else if (hasRailwayParams) {
  poolConfig = {
    host: process.env.PGHOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: process.env.PGPORT || 5432,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
} else {
  // Fallback local (dev)
  const fallbackUrl = 'postgresql://admin_user:SecurePassword123!@localhost:5433/dedouanement_platform';
  poolConfig = { connectionString: fallbackUrl };
}

console.log('--- CONFIGURATION DB ---');
console.log('DATABASE_URL présent :', !!dbUrl);
console.log('Railway PGHOST/POSTGRES_* présents :', hasRailwayParams);
console.log('CORS_ORIGIN/other env non loggées par sécurité.');
console.log('------------------------');

const pool = new Pool(poolConfig);


async function testDatabaseConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✓ Connexion à PostgreSQL réussie à :', res.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ Erreur DB (Vérifie que la BDD existe et que le port est correct) :');
    console.error(err.message);
    return false;
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
  query: (text, params) => pool.query(text, params),
};