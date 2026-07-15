/**
 * INDEX DES MODÈLES
 *
 * Initialise toutes les tables de la base de données
 * dans l'ordre correct (respect des clés étrangères).
 */
const db = require('../config/db');
const User = require('./User');
const Declaration = require('./Declaration');
const Marchandise = require('./Marchandise');
const Offre = require('./Offre');
const Document = require('./Document');
const Message = require('./Message');
const Notification = require('./Notification');
const Nomenclature = require('./Nomenclature');
const DossierDouane = require('./DossierDouane');
const ActionDouane = require('./ActionDouane');
const Taxe = require('./Taxe');

const initModels = async () => {
  try {
    const query = db.query || db;

    console.log('[MODELS] Création des tables...');

    // 1. Tables racines (sans FK)
    await User.createTable();
    console.log('  ✓ users');
    await Declaration.createTable();
    console.log('  ✓ declarations');

    // 2. Tables dépendantes (FK vers users / declarations)
    await Offre.createTable();
    console.log('  ✓ offres');
    await Document.createTable();
    console.log('  ✓ documents');
    await Message.createTable();
    console.log('  ✓ messages');
    await Notification.createTable();
    console.log('  ✓ notifications');

    // 3. NOUVELLES TABLES (workflow douane)
    await Nomenclature.createTable();
    console.log('  ✓ nomenclature_tarifaire');
    await Marchandise.createTable();
    console.log('  ✓ marchandises');
    await DossierDouane.createTable();
    console.log('  ✓ dossiers_douane');
    await ActionDouane.createTable();
    console.log('  ✓ actions_douane');
    await Taxe.createTable();
    console.log('  ✓ taxes');

    // 4. Mise à jour des colonnes existantes
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS statut_validation VARCHAR(20) DEFAULT 'APPROVED',
      ADD COLUMN IF NOT EXISTS num_agrement VARCHAR(50);
    `);

    await query(`
      ALTER TABLE declarations
      ADD COLUMN IF NOT EXISTS transitaire_id INT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS port_depart VARCHAR(255),
      ADD COLUMN IF NOT EXISTS port_arrivee VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_embarquement TIMESTAMP;
    `);

    // Ajouter les colonnes version aux offres si absentes
    await query(`
      ALTER TABLE offres
        ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS rejected_by INT REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);
    console.log('  ✓ colonnes supplémentaires (version, accepted_at, etc.)');

    // Ajouter le champ dossier_id aux documents si absent
    await query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS dossier_id INT REFERENCES dossiers_douane(id) ON DELETE SET NULL;
    `);
    console.log('  ✓ colonne dossier_id dans documents');

    console.log('[MODELS] ✓ Toutes les tables sont prêtes.\n');
  } catch (error) {
    console.error('[MODELS] ❌ Erreur lors de l\'initialisation des tables:', error.message);
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
  Notification,
  Nomenclature,
  DossierDouane,
  ActionDouane,
  Taxe,
};
