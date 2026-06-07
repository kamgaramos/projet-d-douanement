const db = require('../config/db');
const User = require('./User');
const Declaration = require('./Declaration');
const Marchandise = require('./Marchandise');

const initModels = async () => {
  try {
    const query = db.query || db;
    
    // 1. SUPPRESSION DES TABLES (COMMENTÉES POUR GARDER LES DONNÉES)
    // await query('DROP TABLE IF EXISTS marchandises CASCADE');
    // await query('DROP TABLE IF EXISTS declarations CASCADE');
    // await query('DROP TABLE IF EXISTS users CASCADE');
    // console.log('✓ Anciennes tables supprimées.');

    // 2. Création des tables (Si elles existent déjà, cela ne fera rien)
    await User.createTable();
    await Declaration.createTable();
    await Marchandise.createTable();
    
    // 3. Insertion utilisateur de test (on ne le fait que si nécessaire)
    await query(`
      INSERT INTO users (id, username, email, password, role) 
      VALUES (1, 'Kamga', 'kamga@test.com', '$2b$10$hashedpasswordhere', 'declarant')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('✓ Modèles vérifiés/initialisés avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des tables SQL:', error.message);
    throw error;
  }
};

module.exports = { 
  initModels, 
  User, 
  Declaration, 
  Marchandise 
};