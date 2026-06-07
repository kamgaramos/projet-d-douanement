const db = require('../config/db');
const User = require('./User');
const Declaration = require('./Declaration');
const Marchandise = require('./Marchandise');

const initModels = async () => {
  try {
    const query = db.query || db;
    
    // 1. Suppression des tables
    await query('DROP TABLE IF EXISTS marchandises CASCADE');
    await query('DROP TABLE IF EXISTS declarations CASCADE');
    await query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('✓ Anciennes tables supprimées.');

    // 2. Création des tables
    await User.createTable();
    await Declaration.createTable();
    await Marchandise.createTable();
    
    // 3. Insertion utilisateur de test (à l'intérieur de la fonction async)
    await query(`
      INSERT INTO users (id, username, email, password, role) 
      VALUES (1, 'Kamga', 'kamga@test.com', 'password123', 'declarant')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('✓ Tables recréées et utilisateur de test créé (ID: 1)');
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