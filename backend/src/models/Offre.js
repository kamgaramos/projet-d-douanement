const db = require('../config/db');

/**
 * Fonction utilitaire pour exécuter les requêtes SQL
 */
const executeQuery = (text, params) => {
  if (typeof db.query === 'function') {
    return db.query(text, params);
  } else if (typeof db === 'function') {
    return db(text, params);
  } else {
    throw new Error("Impossible de trouver la méthode de requête sur le module de configuration de la base de données.");
  }
};

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS offres (
      id SERIAL PRIMARY KEY,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      transitaire_id INT REFERENCES users(id) ON DELETE CASCADE,
      montant_prestation DECIMAL(10, 2) NOT NULL,
      delai_estime_jours INT NOT NULL,
      message TEXT,
      mode_transport VARCHAR(50),
      statut VARCHAR(20) DEFAULT 'EN_ATTENTE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, []);
};

const Offre = {
  createTable,
  
  // Créer une nouvelle offre
  create: (data) =>
    executeQuery(
      `INSERT INTO offres (declaration_id, transitaire_id, montant_prestation, delai_estime_jours, message, mode_transport) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [data.declaration_id, data.transitaire_id, data.montant_prestation, data.delai_estime_jours, data.message, data.mode_transport]
    ),

  // Récupérer toutes les offres pour une déclaration spécifique
  findByDeclaration: (declaration_id) =>
    executeQuery(`
      SELECT o.*, u.username as transitaire_nom, u.email as transitaire_email
      FROM offres o
      LEFT JOIN users u ON o.transitaire_id = u.id
      WHERE o.declaration_id = $1
      ORDER BY o.created_at DESC
    `, [declaration_id]),

  // Récupérer une offre spécifique par ID
  findById: (id) =>
    executeQuery(`
      SELECT o.*, u.username as transitaire_nom, d.reference as declaration_reference
      FROM offres o
      LEFT JOIN users u ON o.transitaire_id = u.id
      LEFT JOIN declarations d ON o.declaration_id = d.id
      WHERE o.id = $1
    `, [id]),

  // Récupérer les offres d'un transitaire
  findByTransitaire: (transitaire_id) =>
    executeQuery(`
      SELECT o.*, d.reference as declaration_reference
      FROM offres o
      LEFT JOIN declarations d ON o.declaration_id = d.id
      WHERE o.transitaire_id = $1
      ORDER BY o.created_at DESC
    `, [transitaire_id]),

  // Mettre à jour le statut d'une offre
  updateStatut: (id, statut) =>
    executeQuery(`
      UPDATE offres 
      SET statut = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `, [statut, id]),

  // Vérifier si un transitaire a déjà soumis une offre pour une déclaration
  checkExistingOffre: (declaration_id, transitaire_id) =>
    executeQuery(`
      SELECT id FROM offres 
      WHERE declaration_id = $1 AND transitaire_id = $2
    `, [declaration_id, transitaire_id]),

  // Permet de récupérer declaration_id et transitaire_id pour le contrôleur
  getDeclarationAndTransitaire: (offre_id) =>
    executeQuery(`
      SELECT declaration_id, transitaire_id 
      FROM offres 
      WHERE id = $1
    `, [offre_id])
};

module.exports = Offre;