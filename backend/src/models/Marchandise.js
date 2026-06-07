// On récupère directement la fonction query de ton fichier db.js
const { query } = require('../config/db');

const createTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS marchandises (
      id SERIAL PRIMARY KEY,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      description TEXT,
      type_marchandise VARCHAR(100),
      poids DECIMAL(10, 2),
      valeur DECIMAL(10, 2),
      total_taxes DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const Marchandise = {
  createTable,

  create: (declaration_id, description, typeMarchandise, poids, valeur, total_taxes) => {
    const poidsNum = poids ? parseFloat(poids) : 0.00;
    const valeurNum = valeur ? parseFloat(valeur) : 0.00;
    const taxesNum = total_taxes ? parseFloat(total_taxes) : 0.00;

    return query(`
      INSERT INTO marchandises (declaration_id, description, type_marchandise, poids, valeur, total_taxes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [declaration_id, description, typeMarchandise, poidsNum, valeurNum, taxesNum]);
  }
};

module.exports = Marchandise;