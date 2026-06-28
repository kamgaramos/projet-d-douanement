/**
 * MODÈLE TAXE
 * Gère le calcul des droits de douane, TVA et autres frais,
 * ainsi que le suivi du paiement via e-GUCE (simulation).
 */
const db = require('../config/db');

const executeQuery = (text, params) => {
  if (typeof db.query === 'function') return db.query(text, params);
  if (typeof db === 'function') return db(text, params);
  throw new Error('Impossible de trouver la méthode de requête sur le module db.');
};

const STATUTS_PAIEMENT = Object.freeze({
  IMPAYE: 'IMPAYE',
  EN_COURS: 'EN_COURS',
  PAYE: 'PAYE',
  ECHOUE: 'ECHOUE',
});

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS taxes (
      id                    SERIAL PRIMARY KEY,
      dossier_id            INT NOT NULL REFERENCES dossiers_douane(id) ON DELETE CASCADE,
      declaration_id        INT REFERENCES declarations(id) ON DELETE SET NULL,

      -- Droits de douane (calculés basés sur la valeur et le code SH)
      valeur_marchandise    DECIMAL(12,2) NOT NULL DEFAULT 0,
      taux_droit            DECIMAL(5,2) DEFAULT 0,
      droits_douane         DECIMAL(12,2) DEFAULT 0,

      -- TVA
      tva_taux              DECIMAL(5,2) DEFAULT 19.25,
      tva_montant           DECIMAL(12,2) DEFAULT 0,

      -- Autres frais (CSS, PCS, etc.)
      frais_accessoires     DECIMAL(12,2) DEFAULT 0,
      frais_magasinage      DECIMAL(12,2) DEFAULT 0,

      -- Totaux
      total_taxes           DECIMAL(12,2) DEFAULT 0,

      -- Paiement
      statut_paiement       VARCHAR(20) DEFAULT '${STATUTS_PAIEMENT.IMPAYE}',
      reference_paiement    VARCHAR(100),
      mode_paiement         VARCHAR(30),
      date_paiement         TIMESTAMP,
      transaction_id        VARCHAR(100),

      -- Métadonnées
      liquide_par           INT REFERENCES users(id),
      date_liquidation      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes                 TEXT,
      created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_taxes_dossier_id ON taxes(dossier_id);
  `, []);
};

const Taxe = {
  createTable,
  STATUTS_PAIEMENT,

  /**
   * Calcule les taxes pour un dossier donné.
   * Simule le calcul basé sur la valeur déclarée et le taux du code SH.
   */
  calculer: async (dossierId, declarationId, valeurMarchandise, tauxDroit = 10) => {
    const droitsDouane = valeurMarchandise * (tauxDroit / 100);
    const tvaMontant = (valeurMarchandise + droitsDouane) * 0.1925; // 19.25%
    const fraisAccessoires = 50000;  // Frais fixes simulés (CSS)
    const fraisMagasinage = 25000;   // Frais fixes simulés
    const total = droitsDouane + tvaMontant + fraisAccessoires + fraisMagasinage;

    return executeQuery(`
      INSERT INTO taxes
        (dossier_id, declaration_id, valeur_marchandise, taux_droit,
         droits_douane, tva_montant, frais_accessoires, frais_magasinage, total_taxes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [dossierId, declarationId, valeurMarchandise, tauxDroit,
        droitsDouane, tvaMontant, fraisAccessoires, fraisMagasinage, total]);
  },

  /**
   * Trouve la ligne de taxe associée à un dossier.
   */
  findByDossier: (dossierId) =>
    executeQuery(`
      SELECT * FROM taxes WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [dossierId]),

  /**
   * Simule le paiement des taxes via e-GUCE.
   * Retourne une référence de transaction simulée.
   */
  simulerPaiementEguce: async (taxeId, montant, modePaiement = 'ELECTRONIQUE') => {
    const referencePaiement = `EGUCE-${Date.now()}-${taxeId}`;
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    return executeQuery(`
      UPDATE taxes
      SET statut_paiement = $1,
          reference_paiement = $2,
          mode_paiement = $3,
          date_paiement = CURRENT_TIMESTAMP,
          transaction_id = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [STATUTS_PAIEMENT.PAYE, referencePaiement, modePaiement, transactionId, taxeId]);
  },

  /**
   * Trouve une taxe par son ID.
   */
  findById: (id) =>
    executeQuery('SELECT * FROM taxes WHERE id = $1', [id]),

  /**
   * Vérifie si les taxes d'un dossier sont payées.
   */
  estPayee: async (dossierId) => {
    const result = await executeQuery(
      "SELECT statut_paiement FROM taxes WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 1",
      [dossierId]
    );
    return result.rows.length > 0 && result.rows[0].statut_paiement === STATUTS_PAIEMENT.PAYE;
  }
};

module.exports = Taxe;
