// CORRECTION IMPÉRATIVE : Importation sécurisée de l'objet DB global
const db = require('../config/db');

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
    CREATE TABLE IF NOT EXISTS declarations (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(50) UNIQUE NOT NULL,
      declarant_id INT REFERENCES users(id) ON DELETE CASCADE,
      transitaire_id INT REFERENCES users(id) ON DELETE SET NULL,
      port_depart VARCHAR(100),
      port_arrivee VARCHAR(100),
      date_embarquement TIMESTAMP,
      statut VARCHAR(20) DEFAULT 'EN_ATTENTE_OFFRES',
      montant_droits_douane DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, []);
};

const Declaration = {
  createTable,
  
  create: (data) =>
    executeQuery(
      `INSERT INTO declarations (reference, declarant_id, port_depart, port_arrivee, date_embarquement, statut) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        data.reference, 
        data.declarant_id, 
        data.port_depart || null, 
        data.port_arrivee || null, 
        data.date_embarquement || null,
        data.statut || 'brouillon'
      ]
    ),

  findAllAvailable: () =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE UPPER(TRIM(d.statut)) = 'EN_ATTENTE_OFFRES'
      ORDER BY d.created_at DESC
    `, []),

  findAll: () =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      ORDER BY d.created_at DESC
    `, []),

  findByDeclarant: (declarant_id) =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE d.declarant_id = $1
      ORDER BY d.created_at DESC
    `, [declarant_id]),

  findById: (id) =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE d.id = $1
    `, [id]),

  updateStatut: (id, statut, transitaire_id = null) => {
    if (transitaire_id) {
      return executeQuery('UPDATE declarations SET statut = $1, transitaire_id = $2 WHERE id = $3 RETURNING *', [statut, transitaire_id, id]);
    }
    return executeQuery('UPDATE declarations SET statut = $1 WHERE id = $2 RETURNING *', [statut, id]);
  },

  accumulerMontant: (id, total_taxes) => {
    const montantNum = parseFloat(total_taxes) || 0.00;
    return executeQuery(
      'UPDATE declarations SET montant_droits_douane = montant_droits_douane + $1 WHERE id = $2 RETURNING montant_droits_douane',
      [montantNum, id]
    );
  },

  delete: (id) =>
    executeQuery('DELETE FROM declarations WHERE id = $1', [id]),

  deleteMarchandises: (declaration_id) =>
    executeQuery('DELETE FROM marchandises WHERE declaration_id = $1', [declaration_id])
};

module.exports = Declaration;