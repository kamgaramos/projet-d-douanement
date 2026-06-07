// CORRECTION IMPÉRATIVE : Importation sécurisée de l'objet DB global
const db = require('../config/db');

/**
 * Fonction utilitaire pour exécuter les requêtes SQL,
 * gérant à la fois les exports destructurés ou l'appel direct sur l'objet db.
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
  // Structure initiale propre : On gère uniquement le dossier de déclaration ici
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS declarations (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(50) UNIQUE NOT NULL,
      declarant_id INT REFERENCES users(id) ON DELETE CASCADE,
      statut VARCHAR(20) DEFAULT 'brouillon',
      montant_droits_douane DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, []);
};

const Declaration = {
  createTable,
  
  // Insertion focalisée sur la déclaration
  create: (reference, declarant_id) =>
    executeQuery(
      `INSERT INTO declarations (reference, declarant_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [reference, declarant_id]
    ),

  // Récupère une déclaration spécifique avec ses informations de marchandise associées
  findById: (id) =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE d.id = $1
    `, [id]),

  // JOINTURE MAGIQUE : Récupère toutes les déclarations avec les colonnes de la marchandise
  findAll: () =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      ORDER BY d.created_at DESC
    `, []),

  // JOINTURE MAGIQUE : Récupère le catalogue d'un déclarant spécifique
  findByDeclarant: (declarant_id) =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE d.declarant_id = $1 
      ORDER BY d.created_at DESC
    `, [declarant_id]),

  updateStatut: (id, statut) =>
    executeQuery('UPDATE declarations SET statut = $1 WHERE id = $2 RETURNING *', [statut, id]),

  // Accumule le total_taxes calculé sur le montant global des droits de douane
  accumulerMontant: (id, total_taxes) => {
    // Sécurité de conversion pour s'assurer qu'on envoie un nombre valide à PostgreSQL
    const montantNum = parseFloat(total_taxes) || 0.00;
    return executeQuery(
      'UPDATE declarations SET montant_droits_douane = montant_droits_douane + $1 WHERE id = $2 RETURNING montant_droits_douane',
      [montantNum, id]
    );
  }
};

module.exports = Declaration;