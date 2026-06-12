const db = require('../config/db');
const User = require('./User');
const Declaration = require('./Declaration');
const Marchandise = require('./Marchandise');
const Offre = require('./Offre');
const Document = require('./Document');
const Message = require('./Message');
const Notification = require('./Notification');

const initModels = async () => {
  try {
    const query = db.query || db;
    
    // 1. Création des tables
    await User.createTable();
    await Declaration.createTable();
    await Marchandise.createTable();
    await Offre.createTable();
    await Document.createTable();
    await Message.createTable();
    await Notification.createTable();

    // 2. MISE À JOUR : Ajout des colonnes manquantes
    await query(`
      ALTER TABLE declarations 
      ADD COLUMN IF NOT EXISTS transitaire_id INT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS port_depart VARCHAR(255),
      ADD COLUMN IF NOT EXISTS port_arrivee VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_embarquement TIMESTAMP;
    ALTER TABLE offres 
      ADD COLUMN IF NOT EXISTS mode_transport VARCHAR(50);
    `);
    console.log('✓ Colonnes transitaire_id, port_depart, port_arrivee et date_embarquement vérifiées ou ajoutées avec succès.');
    
    // 3. Insertion utilisateur de test
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
  Marchandise,
  Offre,
  Document,
  Message,
  Notification
};