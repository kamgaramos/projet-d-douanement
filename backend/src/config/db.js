const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dedouanement_db',
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