/**
 * NOMENCLATURE TARIFAIRE
 * Table de lookup pour les taux de droits de douane selon le Code SH
 */
const db = require('../config/db');

const executeQuery = (text, params) => {
  if (typeof db.query === 'function') return db.query(text, params);
  if (typeof db === 'function') return db(text, params);
  throw new Error('Impossible de trouver la méthode de requête sur le module db.');
};

const Nomenclature = {
  /**
   * Crée la table de nomenclature tarifaire si elle n'existe pas
   */
  createTable: async () => {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS nomenclature_tarifaire (
        id                SERIAL PRIMARY KEY,
        code_sh           VARCHAR(20) UNIQUE NOT NULL,
        description       TEXT NOT NULL,
        taux_droit        DECIMAL(5,2) NOT NULL,  -- Taux de droit en %
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, []);

    // Insérer les tarifs standards si la table est vide
    const existingCount = await executeQuery('SELECT COUNT(*) FROM nomenclature_tarifaire', []);
    if (existingCount.rows[0].count === 0) {
      await Nomenclature.insertTarifsDefaut();
    }
  },

  /**
   * Insère les tarifs par défaut dans la table
   */
  insertTarifsDefaut: async () => {
    const tarifs = [
      ['0901', 'Café non torréfié', 5],
      ['1001', 'Blé', 10],
      ['1005', 'Maïs', 10],
      ['6204', 'Vêtements (femmes)', 15],
      ['6205', 'Chemises (hommes)', 15],
      ['8471', 'Ordinateurs', 8],
      ['8517.12', 'Électronique - Téléphones', 10],
      ['8703', 'Véhicules automobiles', 20],
      ['8704', 'Véhicules utilitaires', 18],
      ['9406', 'Constructions préfabriquées', 15],
      ['2710', 'Pétrole et dérivés', 12],
      ['2207', 'Alcool éthylique dénaturé', 25],
      ['1704', 'Sucre et confiserie', 20],
      ['0402', 'Lait et crème concentrés', 18],
      ['0701', 'Pommes de terre', 5],
    ];

    for (const [code, desc, taux] of tarifs) {
      await executeQuery(
        'INSERT INTO nomenclature_tarifaire (code_sh, description, taux_droit) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [code, desc, taux]
      );
    }

    console.log('✓ Tarifs par défaut chargés');
  },

  /**
   * Récupère le taux de droit pour un code SH donné
   * Retourne 10% par défaut si le code n'existe pas
   */
  getTauxDroit: async (codeSH) => {
    if (!codeSH) return 10; // Taux par défaut

    try {
      const result = await executeQuery(
        'SELECT taux_droit FROM nomenclature_tarifaire WHERE code_sh = $1',
        [codeSH.trim()]
      );

      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].taux_droit);
      }
    } catch (err) {
      console.error('Erreur lookup tarif:', err.message);
    }

    return 10; // Taux par défaut
  },

  /**
   * Récupère tous les tarifs
   */
  findAll: () =>
    executeQuery('SELECT * FROM nomenclature_tarifaire ORDER BY code_sh', []),

  /**
   * Ajoute un nouveau tarif
   */
  add: (codeSH, description, tauxDroit) =>
    executeQuery(
      'INSERT INTO nomenclature_tarifaire (code_sh, description, taux_droit) VALUES ($1, $2, $3) RETURNING *',
      [codeSH, description, tauxDroit]
    ),

  /**
   * Met à jour un tarif
   */
  update: (codeSH, tauxDroit) =>
    executeQuery(
      'UPDATE nomenclature_tarifaire SET taux_droit = $1, updated_at = CURRENT_TIMESTAMP WHERE code_sh = $2 RETURNING *',
      [tauxDroit, codeSH]
    ),
};

module.exports = Nomenclature;
