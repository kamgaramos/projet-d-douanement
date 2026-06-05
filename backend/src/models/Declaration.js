const { query } = require('../config/db');

const createTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS declarations (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(50) UNIQUE NOT NULL,
      declarant_id INT REFERENCES users(id) ON DELETE CASCADE,
      statut VARCHAR(20) DEFAULT 'brouillon',
      montant_droits_douane DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const Declaration = {
  createTable,
  create: (reference, declarant_id) =>
    query(
      'INSERT INTO declarations (reference, declarant_id) VALUES ($1, $2) RETURNING *',
      [reference, declarant_id]
    ),
  findById: (id) =>
    query('SELECT * FROM declarations WHERE id = $1', [id]),
  findAll: () =>
    query('SELECT * FROM declarations ORDER BY created_at DESC'),
  findByDeclarant: (declarant_id) =>
    query('SELECT * FROM declarations WHERE declarant_id = $1 ORDER BY created_at DESC', [declarant_id]),
  updateStatut: (id, statut) =>
    query('UPDATE declarations SET statut = $1 WHERE id = $2 RETURNING *', [statut, id]),
  // Accumule le total_taxes de la nouvelle marchandise sur montant_droits_douane
  accumulerMontant: (id, total_taxes) =>
    query(
      'UPDATE declarations SET montant_droits_douane = montant_droits_douane + $1 WHERE id = $2 RETURNING montant_droits_douane',
      [total_taxes, id]
    ),
};

module.exports = Declaration;
