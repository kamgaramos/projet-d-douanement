/**
 * MODÈLE OFFRE
 * Gère les offres des transitaires avec :
 * - Machine à états stricte (PENDING → ACCEPTED | REJECTED | EXPIRED)
 * - Optimistic locking (version) pour la concurrence
 * - Validation des transitions
 */
const db = require('../config/db');

const executeQuery = (text, params) => {
  if (typeof db.query === 'function') return db.query(text, params);
  if (typeof db === 'function') return db(text, params);
  throw new Error('Impossible de trouver la méthode de requête sur le module de configuration de la base de données.');
};

// ─── Enumérations des statuts ───────────────────────────────────────────────

const STATUTS = Object.freeze({
  PENDING:  'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED:  'EXPIRED',
});

/**
 * Transitions autorisées entre statuts.
 * PENDING est le seul état initial depuis lequel on peut accepter/rejeter.
 */
const TRANSITIONS = Object.freeze({
  [STATUTS.PENDING]:  [STATUTS.ACCEPTED, STATUTS.REJECTED, STATUTS.EXPIRED],
  [STATUTS.ACCEPTED]: [],   // État final
  [STATUTS.REJECTED]: [],   // État final
  [STATUTS.EXPIRED]:  [],   // État final
});

// ─── Construction de la table (avec VERSION pour optimistic locking) ────────

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS offres (
      id                SERIAL PRIMARY KEY,
      declaration_id    INT REFERENCES declarations(id) ON DELETE CASCADE,
      transitaire_id    INT REFERENCES users(id) ON DELETE CASCADE,
      montant_prestation DECIMAL(10, 2) NOT NULL,
      delai_estime_jours INT NOT NULL,
      message           TEXT,
      mode_transport    VARCHAR(50),
      statut            VARCHAR(20) DEFAULT '${STATUTS.PENDING}',
      version           INT DEFAULT 1,              -- Optimistic locking
      rejected_by       INT REFERENCES users(id),    -- Qui a rejeté
      rejection_reason  TEXT,                        -- Motif du rejet
      accepted_at       TIMESTAMP,                   -- Date d'acceptation
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, []);
};

// ─── Modèle ─────────────────────────────────────────────────────────────────

const Offre = {
  createTable,
  STATUTS,
  TRANSITIONS,

  // ── Validation ──────────────────────────────────────────────────────────

  /**
   * Vérifie si une transition de statut est autorisée.
   */
  transitionAutorisee(from, to) {
    const allowed = TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  },

  // ── CRUD ────────────────────────────────────────────────────────────────

  create: (data) =>
    executeQuery(
      `INSERT INTO offres (declaration_id, transitaire_id, montant_prestation, delai_estime_jours, message, mode_transport)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.declaration_id, data.transitaire_id, data.montant_prestation, data.delai_estime_jours, data.message, data.mode_transport]
    ),

  findById: (id) =>
    executeQuery(`
      SELECT o.*, u.username as transitaire_nom, d.reference as declaration_reference
      FROM offres o
      LEFT JOIN users u ON o.transitaire_id = u.id
      LEFT JOIN declarations d ON o.declaration_id = d.id
      WHERE o.id = $1
    `, [id]),

  findByDeclaration: (declaration_id) =>
    executeQuery(`
      SELECT o.*, u.username as transitaire_nom, u.email as transitaire_email
      FROM offres o
      LEFT JOIN users u ON o.transitaire_id = u.id
      WHERE o.declaration_id = $1
      ORDER BY o.created_at DESC
    `, [declaration_id]),

  findByTransitaire: (transitaire_id) =>
    executeQuery(`
      SELECT o.*, d.reference as declaration_reference
      FROM offres o
      LEFT JOIN declarations d ON o.declaration_id = d.id
      WHERE o.transitaire_id = $1
      ORDER BY o.created_at DESC
    `, [transitaire_id]),

  checkExistingOffre: (declaration_id, transitaire_id) =>
    executeQuery(`
      SELECT id FROM offres
      WHERE declaration_id = $1 AND transitaire_id = $2
    `, [declaration_id, transitaire_id]),

  getDeclarationAndTransitaire: (offre_id) =>
    executeQuery(`
      SELECT declaration_id, transitaire_id
      FROM offres
      WHERE id = $1
    `, [offre_id]),

  // ── Transition d'état avec OPTIMISTIC LOCKING ───────────────────────────

  /**
   * Met à jour le statut d'une offre UNIQUEMENT si la version correspond.
   *
   * Principe de l'optimistic locking :
   *   UPDATE ... SET statut = $1, version = version + 1
   *   WHERE id = $2 AND version = $3
   *
   * Si aucun row n'est affecté (rowCount === 0), c'est qu'un concurrent
   * a déjà modifié l'offre → CONFLIT.
   *
   * @param {number} id        - ID de l'offre
   * @param {string} statut    - Nouveau statut
   * @param {number} version   - Version attendue (optimistic lock)
   * @param {object} extras    - Champs optionnels (ex: rejected_by, rejection_reason)
   * @returns {Promise<object>} Résultat de la requête (rowCount, rows)
   */
  transitionStatut: (id, statut, version, extras = {}) => {
    const setClauses = [
      'statut = $1',
      'version = version + 1',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const params = [statut];
    let idx = 2;

    // Champs optionnels
    if (extras.accepted_at !== undefined) {
      setClauses.push(`accepted_at = $${idx}`);
      params.push(extras.accepted_at);
      idx++;
    }
    if (extras.rejected_by !== undefined) {
      setClauses.push(`rejected_by = $${idx}`);
      params.push(extras.rejected_by);
      idx++;
    }
    if (extras.rejection_reason !== undefined) {
      setClauses.push(`rejection_reason = $${idx}`);
      params.push(extras.rejection_reason);
      idx++;
    }

    params.push(id, version);

    return executeQuery(`
      UPDATE offres
      SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND version = $${idx + 1}
      RETURNING *
    `, params);
  },
};

module.exports = Offre;
