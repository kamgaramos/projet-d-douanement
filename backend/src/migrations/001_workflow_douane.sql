-- =============================================================================
-- MIGRATION 001 : WORKFLOW DE DÉDOUANEMENT ET OPTIMISTIC LOCKING
-- =============================================================================
-- Ce fichier contient les instructions SQL complètes pour créer les nouvelles
-- tables et modifier les existantes afin de supporter :
--   1. La gestion robuste des offres (optimistic locking)
--   2. Le workflow de dédouanement (circuits, actions, taxes, BAE)
--
-- Exécution : psql -U admin_user -d dedouanement_platform -f 001_workflow_douane.sql
-- =============================================================================

BEGIN;

-- ── 1. OFFRE : Ajout de l'optimistic locking et des nouveaux champs ─────────

ALTER TABLE IF EXISTS offres
  ADD COLUMN IF NOT EXISTS version          INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepted_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejected_by      INT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Index pour retrouver rapidement les offres pending/expired
CREATE INDEX IF NOT EXISTS idx_offres_statut ON offres(statut);

-- ── 2. DOSSIER DOUANE (table principale du workflow) ─────────────────────────

CREATE TABLE IF NOT EXISTS dossiers_douane (
  id                    SERIAL PRIMARY KEY,
  offre_id              INT NOT NULL REFERENCES offres(id) ON DELETE CASCADE,
  declaration_id        INT NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
  transitaire_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference             VARCHAR(50) UNIQUE NOT NULL,

  -- Statut dans la machine à états du dédouanement
  statut                VARCHAR(30) DEFAULT 'DOCUMENTS_ATTENDUS',

  -- Circuit de dédouanement (VERT / JAUNE / ROUGE)
  circuit               VARCHAR(20),

  -- Décision de l'inspecteur
  decision_inspecteur   VARCHAR(20) DEFAULT 'EN_ATTENTE',
  motif_rejet           TEXT,
  commentaire_inspecteur TEXT,

  -- Validation
  valide_par            INT REFERENCES users(id),
  date_validation       TIMESTAMP,

  -- Paiement
  montant_taxes         DECIMAL(12,2) DEFAULT 0,
  reference_paiement    VARCHAR(100),
  date_paiement         TIMESTAMP,

  -- BAE (Bon à Enlever)
  bae_reference         VARCHAR(50) UNIQUE,
  bae_url               TEXT,
  date_bae              TIMESTAMP,

  -- Optimistic locking
  version               INT DEFAULT 1,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_dossiers_douane_offre_id        ON dossiers_douane(offre_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_douane_declaration_id  ON dossiers_douane(declaration_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_douane_statut          ON dossiers_douane(statut);
CREATE INDEX IF NOT EXISTS idx_dossiers_douane_transitaire_id  ON dossiers_douane(transitaire_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_douane_bae_reference   ON dossiers_douane(bae_reference);

-- ── 3. ACTIONS DOUANE (journal d'audit) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS actions_douane (
  id              SERIAL PRIMARY KEY,
  dossier_id      INT NOT NULL REFERENCES dossiers_douane(id) ON DELETE CASCADE,
  utilisateur_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR(30) NOT NULL,
  commentaire     TEXT,
  details         JSONB,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_actions_douane_dossier_id       ON actions_douane(dossier_id);
CREATE INDEX IF NOT EXISTS idx_actions_douane_utilisateur_id   ON actions_douane(utilisateur_id);

-- ── 4. TAXES (liquidation et paiement) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS taxes (
  id                    SERIAL PRIMARY KEY,
  dossier_id            INT NOT NULL REFERENCES dossiers_douane(id) ON DELETE CASCADE,
  declaration_id        INT REFERENCES declarations(id) ON DELETE SET NULL,

  -- Assiette de calcul
  valeur_marchandise    DECIMAL(12,2) NOT NULL DEFAULT 0,
  taux_droit            DECIMAL(5,2) DEFAULT 0,

  -- Droits de douane
  droits_douane         DECIMAL(12,2) DEFAULT 0,

  -- TVA (taux standard: 19.25%)
  tva_taux              DECIMAL(5,2) DEFAULT 19.25,
  tva_montant           DECIMAL(12,2) DEFAULT 0,

  -- Frais accessoires (CSS, PCS, magasinage)
  frais_accessoires     DECIMAL(12,2) DEFAULT 0,
  frais_magasinage      DECIMAL(12,2) DEFAULT 0,

  -- Total
  total_taxes           DECIMAL(12,2) DEFAULT 0,

  -- Paiement
  statut_paiement       VARCHAR(20) DEFAULT 'IMPAYE',
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

CREATE INDEX IF NOT EXISTS idx_taxes_dossier_id ON taxes(dossier_id);

-- ── 5. DOCUMENTS : Ajout du lien vers le dossier douane ─────────────────────

ALTER TABLE IF EXISTS documents
  ADD COLUMN IF NOT EXISTS dossier_id INT REFERENCES dossiers_douane(id) ON DELETE SET NULL;

-- ── 6. ERROR LOG (Dead Letter Queue pour les erreurs non récupérables) ──────

CREATE TABLE IF NOT EXISTS error_log (
  id          SERIAL PRIMARY KEY,
  context     VARCHAR(100) NOT NULL,
  error_msg   TEXT NOT NULL,
  stack_trace TEXT,
  payload     JSONB,
  status      VARCHAR(20) DEFAULT 'PENDING',
  retry_count INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_log_status ON error_log(status);

-- ── 7. Mise à jour des statuts existants ─────────────────────────────────────

-- Uniformiser les statuts existants dans declarations si besoin
-- (à exécuter après validation des données)
-- UPDATE declarations SET statut = 'EN_ATTENTE_OFFRES' WHERE UPPER(TRIM(statut)) = 'PUBLIEE';

COMMIT;

-- =============================================================================
-- RÉSUMÉ DES STATUTS ET TRANSITIONS
-- =============================================================================
--
-- OFFRE :
--   PENDING ──┬── ACCEPTED (→ création dossier douane)
--             ├── REJECTED
--             └── EXPIRED
--
-- DOSSIER DOUANE :
--   DOCUMENTS_ATTENDUS ──→ SOUMIS ──→ ANALYSE_RISQUE
───┬── CIRCUIT_VERT ──→ VALIDE ──→ LIQUIDATION ──→ PAIEMENT ──→ BAE_GENERE
───┬── CIRCUIT_JAUNE ──→ EN_ATTENTE_VALIDATION ──┬── VALIDE → LIQUIDATION...
───┬── CIRCUIT_ROUGE ──→ EN_ATTENTE_VALIDATION ──┴── REJETE (fin)
───┘                                               └── COMPLEMENT_ATTENDU → SOUMIS (loop)
-- =============================================================================
