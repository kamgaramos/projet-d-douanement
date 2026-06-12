const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin_user:SecurePassword123!@localhost:5433/dedouanement_platform',
});

// Définition explicite de la fonction
async function testDatabaseConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Connexion à PostgreSQL réussie');
    return true;
  } catch (err) {
    console.error('❌ Erreur DB:', err.message);
    return false;
  }
}

// Exportation en tant qu'objet
module.exports = {
  pool,
  testDatabaseConnection,
  query: (text, params) => pool.query(text, params),
};