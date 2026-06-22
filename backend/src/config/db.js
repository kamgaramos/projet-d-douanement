const { Pool } = require('pg');

// Log pour le diagnostic : savoir quelle URL est utilisée
const dbUrl = process.env.DATABASE_URL || 'postgresql://admin_user:SecurePassword123!@localhost:5433/dedouanement_platform';
console.log("--- CONFIGURATION DB ---");
console.log("URL de connexion utilisée :", dbUrl);
console.log("------------------------");

const pool = new Pool({
  connectionString: dbUrl,
});

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