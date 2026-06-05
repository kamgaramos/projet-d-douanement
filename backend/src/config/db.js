/**
 * Configuration PostgreSQL et Pool de connexion
 * Initialise et exporte un Pool pour toutes les requêtes à la base de données
 */

const { Pool } = require('pg');

// Récupération de l'URL de connexion depuis les variables d'environnement
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/dedouanement_db';

// Création du Pool de connexion PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Options additionnelles pour optimiser les performances
  max: 20, // Nombre maximum de connexions simultanées
  idleTimeoutMillis: 30000, // Timeout d'inactivité (30 secondes)
  connectionTimeoutMillis: 2000, // Timeout de connexion (2 secondes)
});

// Gestion des événements du Pool
pool.on('connect', () => {
  console.log('✓ Nouvelle connexion établie au Pool PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erreur non attendue sur une connexion du Pool:', err);
  process.exit(-1);
});

/**
 * Fonction pour tester la connexion à la base de données
 * @returns {Promise<void>}
 */
const testDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    
    // Exécution d'une simple requête de test
    const result = await client.query('SELECT NOW()');
    
    console.log('✓ Connexion à PostgreSQL réussie');
    console.log(`  Base de données: ${result.rows[0].now}`);
    
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Erreur lors de la connexion à PostgreSQL:', err.message);
    return false;
  }
};

// Exportation du Pool et de la fonction de test
module.exports = {
  pool,
  testDatabaseConnection,
  query: (text, params) => pool.query(text, params), // Helper pour les requêtes directes
};
