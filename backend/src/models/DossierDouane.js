/**
 * MODÈLE DOSSIER DOUANE
 * Gère le cycle de vie complet du dossier de dédouanement
 * depuis la création (acceptation offre) jusqu'au BAE.
 */
const db = require('../config/db');

const executeQuery = (text, params) => {
  if (typeof db.query === 'function') return db.query(text, params);
  if (typeof db === 'function') return db(text, params);
  throw new Error('Impossible de trouver la méthode de requête sur le module db.');
};

// ─── Enumérations ───────────────────────────────────────────────────────────

/** Circuits de dédouanement possibles */
const CIRCUITS = Object.freeze({
  VERT:  'VERT',
  JAUNE: 'JAUNE',
  ROUGE: 'ROUGE',
});

/** Décisions de l'inspecteur douanier */
const DECISIONS = Object.freeze({
  EN_ATTENTE:    'EN_ATTENTE',
  VALIDE:        'VALIDE',
  REJETE:        'REJETE',
  COMPLEMENT:    'COMPLEMENT',
});

/**
 * Statuts du cycle de vie complet du dossier.
 *
 * DOCUMENTS_ATTENDUS    → Transitaire doit soumettre les pièces
 * SOUMIS                → Documents déposés, en attente d'analyse
 * ANALYSE_RISQUE        → Affectation du circuit (automatique)
 * CIRCUIT_VERT          → Validation automatique (sans inspection)
 * CIRCUIT_JAUNE         → Contrôle documentaire requis
 * CIRCUIT_ROUGE         → Contrôle physique requis
 * EN_ATTENTE_VALIDATION → En attente de décision douanière
 * VALIDE                → Dossier validé par la douane
 * REJETE                → Dossier rejeté
 * COMPLEMENT_ATTENDU    → Pièces complémentaires demandées
 * EN_LIQUIDATION        → Calcul des taxes en cours
 * EN_ATTENTE_PAIEMENT   → Paiement des taxes via e-GUCE
 * PAYE                  → Paiement confirmé
 * BAE_GENERE            → Bon à Enlever émis
 */
const STATUTS = Object.freeze({
  DOCUMENTS_ATTENDUS:    'DOCUMENTS_ATTENDUS',
  SOUMIS:                'SOUMIS',
  ANALYSE_RISQUE:        'ANALYSE_RISQUE',
  CIRCUIT_VERT:          'CIRCUIT_VERT',
  CIRCUIT_JAUNE:         'CIRCUIT_JAUNE',
  CIRCUIT_ROUGE:         'CIRCUIT_ROUGE',
  EN_ATTENTE_VALIDATION: 'EN_ATTENTE_VALIDATION',
  VALIDE:                'VALIDE',
  REJETE:                'REJETE',
  COMPLEMENT_ATTENDU:    'COMPLEMENT_ATTENDU',
  EN_LIQUIDATION:        'EN_LIQUIDATION',
  EN_ATTENTE_PAIEMENT:   'EN_ATTENTE_PAIEMENT',
  PAYE:                  'PAYE',
  BAE_GENERE:            'BAE_GENERE',
});

/**
 * Machine à états : définit pour chaque statut la liste des statuts
 * atteignables. Toute transition hors de cette liste est refusée.
 */
const TRANSITIONS = Object.freeze({
  [STATUTS.DOCUMENTS_ATTENDUS]:    [STATUTS.SOUMIS],
  [STATUTS.SOUMIS]:                [STATUTS.ANALYSE_RISQUE],
  [STATUTS.ANALYSE_RISQUE]:       [STATUTS.CIRCUIT_VERT, STATUTS.CIRCUIT_JAUNE, STATUTS.CIRCUIT_ROUGE],
  [STATUTS.CIRCUIT_VERT]:          [STATUTS.VALIDE],
  [STATUTS.CIRCUIT_JAUNE]:         [STATUTS.EN_ATTENTE_VALIDATION],
  [STATUTS.CIRCUIT_ROUGE]:         [STATUTS.EN_ATTENTE_VALIDATION],
  [STATUTS.EN_ATTENTE_VALIDATION]: [STATUTS.VALIDE, STATUTS.REJETE, STATUTS.COMPLEMENT_ATTENDU],
  [STATUTS.COMPLEMENT_ATTENDU]:    [STATUTS.SOUMIS],
  [STATUTS.VALIDE]:                [STATUTS.EN_LIQUIDATION],
  [STATUTS.EN_LIQUIDATION]:        [STATUTS.EN_ATTENTE_PAIEMENT],
  [STATUTS.EN_ATTENTE_PAIEMENT]:   [STATUTS.PAYE],
  [STATUTS.PAYE]:                  [STATUTS.BAE_GENERE],
  [STATUTS.REJETE]:                [],        // Terminus
  [STATUTS.BAE_GENERE]:            [],        // Terminus
});

// ─── Construction de la table ───────────────────────────────────────────────

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS dossiers_douane (
      id                  SERIAL PRIMARY KEY,
      offre_id            INT NOT NULL REFERENCES offres(id) ON DELETE CASCADE,
      declaration_id      INT NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
      transitaire_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reference           VARCHAR(50) UNIQUE NOT NULL,
      statut              VARCHAR(30) DEFAULT '${STATUTS.DOCUMENTS_ATTENDUS}',
      circuit             VARCHAR(20),
      decision_inspecteur VARCHAR(20) DEFAULT '${DECISIONS.EN_ATTENTE}',
      motif_rejet         TEXT,
      commentaire_inspecteur TEXT,

      -- Informations de validation
      valide_par          INT REFERENCES users(id),
      date_validation     TIMESTAMP,

      -- Informations de paiement
      montant_taxes       DECIMAL(12,2) DEFAULT 0,
      reference_paiement  VARCHAR(100),
      date_paiement       TIMESTAMP,

      -- BAE
      bae_reference       VARCHAR(50) UNIQUE,
      bae_url             TEXT,
      date_bae            TIMESTAMP,

      -- Version pour optimistic locking
      version             INT DEFAULT 1,

      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_dossiers_douane_offre_id ON dossiers_douane(offre_id);
  `, []);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_dossiers_douane_declaration_id ON dossiers_douane(declaration_id);
  `, []);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_dossiers_douane_statut ON dossiers_douane(statut);
  `, []);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_dossiers_douane_transitaire_id ON dossiers_douane(transitaire_id);
  `, []);
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_dossiers_douane_bae_reference ON dossiers_douane(bae_reference);
  `, []);
};

// ─── Méthodes du modèle ─────────────────────────────────────────────────────

const DossierDouane = {
  createTable,
  CIRCUITS,
  DECISIONS,
  STATUTS,
  TRANSITIONS,

  /**
   * Vérifie si une transition de statut est autorisée par la machine à états.
   * @param {string} from  - Statut actuel
   * @param {string} to    - Statut cible
   * @returns {boolean}
   */
  transitionAutorisee(from, to) {
    const allowed = TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  },

  /**
   * Crée un dossier douane suite à l'acceptation d'une offre.
   */
  create: (data) => {
    const reference = `DOU-${Date.now()}-${data.offre_id}`;
    return executeQuery(`
      INSERT INTO dossiers_douane
        (offre_id, declaration_id, transitaire_id, reference)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [data.offre_id, data.declaration_id, data.transitaire_id, reference]);
  },

  /**
   * Trouve un dossier par son ID.
   */
  findById: (id) =>
    executeQuery(`
      SELECT dd.*,
             d.reference AS declaration_reference,
             u.username AS transitaire_nom,
             u.email AS transitaire_email
      FROM dossiers_douane dd
      LEFT JOIN declarations d ON dd.declaration_id = d.id
      LEFT JOIN users u ON dd.transitaire_id = u.id
      WHERE dd.id = $1
    `, [id]),

  /**
   * Trouve un dossier par l'ID de l'offre associée.
   */
  findByOffreId: (offreId) =>
    executeQuery(`
      SELECT * FROM dossiers_douane WHERE offre_id = $1
    `, [offreId]),

  /**
   * Trouve un dossier par la référence BAE.
   */
  findByBaeReference: (baeRef) =>
    executeQuery(`
      SELECT * FROM dossiers_douane WHERE bae_reference = $1
    `, [baeRef]),

  /**
   * Liste les dossiers d'un transitaire.
   */
  findByTransitaire: (transitaireId) =>
    executeQuery(`
      SELECT dd.*, d.reference AS declaration_reference
      FROM dossiers_douane dd
      LEFT JOIN declarations d ON dd.declaration_id = d.id
      WHERE dd.transitaire_id = $1
      ORDER BY dd.created_at DESC
    `, [transitaireId]),

  /**
   * Liste les dossiers en attente d'action douanière.
   */
  findEnAttenteDouane: () =>
    executeQuery(`
      SELECT dd.*, d.reference AS declaration_reference,
             u.username AS transitaire_nom,
             m.type_marchandise, m.description AS marchandise_description
      FROM dossiers_douane dd
      LEFT JOIN declarations d ON dd.declaration_id = d.id
      LEFT JOIN users u ON dd.transitaire_id = u.id
      LEFT JOIN marchandises m ON m.declaration_id = dd.declaration_id
      WHERE dd.statut IN ('${STATUTS.EN_ATTENTE_VALIDATION}')
      ORDER BY dd.updated_at ASC
    `, []),

  /**
   * Liste les dossiers d'un déclarant via ses déclarations.
   */
  findByDeclarant: (declarantId) =>
    executeQuery(`
      SELECT dd.*, d.reference AS declaration_reference
      FROM dossiers_douane dd
      LEFT JOIN declarations d ON dd.declaration_id = d.id
      WHERE d.declarant_id = $1
      ORDER BY dd.created_at DESC
    `, [declarantId]),

  /**
   * Transition d'état AVEC optimistic locking.
   *
   * La mise à jour n'affecte une ligne que si la version correspond.
   * `result.rowCount === 0` signifie qu'un concurrent a modifié l'entité.
   */
  transitionStatut: (id, nouveauStatut, version, extras = {}) => {
    const setClauses = [
      'statut = $1',
      'version = version + 1',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const params = [nouveauStatut];
    let idx = 2;

    // Ajoute les champs optionnels (ex: circuit, decision_inspecteur, etc.)
    const fields = [
      'circuit', 'decision_inspecteur', 'motif_rejet',
      'commentaire_inspecteur', 'valide_par', 'date_validation',
      'montant_taxes', 'reference_paiement', 'date_paiement',
      'bae_reference', 'bae_url', 'date_bae'
    ];
    for (const field of fields) {
      if (extras[field] !== undefined) {
        setClauses.push(`${field} = $${idx}`);
        params.push(extras[field]);
        idx++;
      }
    }

    params.push(id, version);

    return executeQuery(`
      UPDATE dossiers_douane
      SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND version = $${idx + 1}
      RETURNING *
    `, params);
  },

  /**
   * Récupère tous les dossiers (pour tableau de bord admin).
   */
  findAll: (filters = {}) => {
    let sql = `
      SELECT dd.*, d.reference AS declaration_reference,
             u.username AS transitaire_nom
      FROM dossiers_douane dd
      LEFT JOIN declarations d ON dd.declaration_id = d.id
      LEFT JOIN users u ON dd.transitaire_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (filters.statut) {
      conditions.push(`dd.statut = $${params.length + 1}`);
      params.push(filters.statut);
    }
    if (filters.circuit) {
      conditions.push(`dd.circuit = $${params.length + 1}`);
      params.push(filters.circuit);
    }
    if (filters.transitaire_id) {
      conditions.push(`dd.transitaire_id = $${params.length + 1}`);
      params.push(filters.transitaire_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY dd.created_at DESC';

    return executeQuery(sql, params);
  }
};

module.exports = DossierDouane;
