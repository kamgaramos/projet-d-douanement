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

const Declaration = {
  createTable: async () => {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS declarations (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(50) UNIQUE NOT NULL,
        declarant_id INT REFERENCES users(id) ON DELETE CASCADE,
        transitaire_id INT REFERENCES users(id) ON DELETE SET NULL,
        port_depart VARCHAR(100),
        port_arrivee VARCHAR(100),
        date_embarquement TIMESTAMP,
        statut VARCHAR(50) DEFAULT 'EN_ATTENTE_OFFRES',
        montant_droits_douane DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
  },

  // --- MÉTHODE CRÉATION ---
  create: async (data) => {
    const reference = data.reference || `DEC-${Date.now()}`;
    const sql = `
      INSERT INTO declarations (reference, declarant_id, statut, port_depart, port_arrivee, date_embarquement, montant_droits_douane)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    return executeQuery(sql, [
      reference,
      data.declarant_id,
      data.statut || 'brouillon',
      data.port_depart || null,
      data.port_arrivee || null,
      data.date_embarquement || null,
      data.montant_droits_douane || 0
    ]);
  },

  findById: (id) =>
    executeQuery(`
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE d.id = $1
    `, [id]),

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

  findAllForDouanierQueue: async () => {
    const sql = `
      SELECT d.*, m.description, m.type_marchandise, m.poids, m.valeur 
      FROM declarations d
      LEFT JOIN marchandises m ON d.id = m.declaration_id
      WHERE UPPER(TRIM(d.statut)) = 'EN_ATTENTE_VALIDATION_DOUANE'
      ORDER BY d.created_at DESC
    `;
    try {
      const result = await executeQuery(sql, []);
      return result;
    } catch (err) {
      console.error("[DEBUG] Erreur fatale :", err.message);
      throw err;
    }
  },

  updateStatut: (id, statut, transitaire_id = null) => {
    if (transitaire_id) {
      return executeQuery('UPDATE declarations SET statut = $1, transitaire_id = $2 WHERE id = $3 RETURNING *', [statut, transitaire_id, id]);
    }
    return executeQuery('UPDATE declarations SET statut = $1 WHERE id = $2 RETURNING *', [statut, id]);
  },

  updateMontantDroits: (id, montant) =>
    executeQuery('UPDATE declarations SET montant_droits_douane = $1 WHERE id = $2 RETURNING *', [montant, id]),

  accumulerMontant: (id, montant) =>
    executeQuery('UPDATE declarations SET montant_droits_douane = montant_droits_douane + $1 WHERE id = $2 RETURNING *', [montant, id]),
};

module.exports = Declaration;