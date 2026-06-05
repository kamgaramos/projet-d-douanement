const { query } = require('../config/db');

const createTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS marchandises (
      id SERIAL PRIMARY KEY,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      code_sh VARCHAR(10) NOT NULL,
      valeur_caf DECIMAL(10, 2) NOT NULL,
      poids_net DECIMAL(10, 2) NOT NULL,
      droit_douane DECIMAL(10, 2) DEFAULT 0.00,
      tva DECIMAL(10, 2) DEFAULT 0.00,
      total_taxes DECIMAL(10, 2) DEFAULT 0.00
    )
  `);
};

const Marchandise = {
  createTable,
  // Insertion avec les taxes calculées
  create: (declaration_id, description, code_sh, valeur_caf, poids_net, droit_douane, tva, total_taxes) =>
    query(
      `INSERT INTO marchandises
        (declaration_id, description, code_sh, valeur_caf, poids_net, droit_douane, tva, total_taxes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [declaration_id, description, code_sh, valeur_caf, poids_net, droit_douane, tva, total_taxes]
    ),
  findByDeclaration: (declaration_id) =>
    query('SELECT * FROM marchandises WHERE declaration_id = $1', [declaration_id]),
  deleteById: (id) =>
    query('DELETE FROM marchandises WHERE id = $1', [id]),
};

module.exports = Marchandise;
