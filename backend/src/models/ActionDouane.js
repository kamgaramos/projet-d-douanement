/**
 * MODÈLE ACTION DOUANE
 * Journal d'audit : chaque action de l'inspecteur douanier
 * est enregistrée pour traçabilité.
 */
const db = require('../config/db');

const executeQuery = (text, params) => {
  if (typeof db.query === 'function') return db.query(text, params);
  if (typeof db === 'function') return db(text, params);
  throw new Error('Impossible de trouver la méthode de requête sur le module db.');
};

const TYPES_ACTION = Object.freeze({
  VALIDER:            'VALIDER',
  REJETER:            'REJETER',
  DEMANDER_COMPLEMENT:'DEMANDER_COMPLEMENT',
  AFFECTER_CIRCUIT:   'AFFECTER_CIRCUIT',
  LIQUIDER:           'LIQUIDER',
  CONFIRMER_PAIEMENT: 'CONFIRMER_PAIEMENT',
  GENERER_BAE:        'GENERER_BAE',
});

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS actions_douane (
      id              SERIAL PRIMARY KEY,
      dossier_id      INT NOT NULL REFERENCES dossiers_douane(id) ON DELETE CASCADE,
      utilisateur_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action          VARCHAR(30) NOT NULL,
      commentaire     TEXT,
      details         JSONB,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_actions_douane_dossier_id ON actions_douane(dossier_id);
  `, []);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_actions_douane_utilisateur_id ON actions_douane(utilisateur_id);
  `, []);
};

const ActionDouane = {
  createTable,
  TYPES_ACTION,

  enregistrer: (dossierId, utilisateurId, action, commentaire = null, details = null) =>
    executeQuery(`
      INSERT INTO actions_douane (dossier_id, utilisateur_id, action, commentaire, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [dossierId, utilisateurId, action, commentaire, details ? JSON.stringify(details) : null]),

  findByDossier: (dossierId) =>
    executeQuery(`
      SELECT a.*, u.username AS utilisateur_nom
      FROM actions_douane a
      LEFT JOIN users u ON a.utilisateur_id = u.id
      WHERE a.dossier_id = $1
      ORDER BY a.created_at ASC
    `, [dossierId]),

  findByUtilisateur: (utilisateurId) =>
    executeQuery(`
      SELECT a.*, dd.reference AS dossier_reference
      FROM actions_douane a
      LEFT JOIN dossiers_douane dd ON a.dossier_id = dd.id
      WHERE a.utilisateur_id = $1
      ORDER BY a.created_at DESC
    `, [utilisateurId]),
};

module.exports = ActionDouane;
