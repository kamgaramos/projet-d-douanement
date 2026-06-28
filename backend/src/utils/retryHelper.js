/**
 * HELPER DE REPRISE (RETRY)
 *
 * Stratégie de résilience pour les appels externes (e-GUCE/CAMCIS) :
 * 1. Tentative initiale
 * 2. Nouvelle tentative avec backoff exponentiel + jitter
 * 3. Échec → log dans la table error_log pour rejeu manuel
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const RETRY_CONFIG = {
  maxRetries: 3,               // Nombre max de tentatives (hors première)
  baseDelayMs: 1000,           // Délai initial (1s)
  maxDelayMs: 30000,           // Délai max (30s)
};

// ─── Backoff exponentiel avec jitter ──────────────────────────────────────

/**
 * Calcule le délai d'attente pour une tentative donnée.
 * Utilise un "full jitter" pour éviter les thundering herds.
 *
 * delay = random(0, min(maxDelay, baseDelay * 2^attempt))
 */
const calculateDelay = (attempt) => {
  const exponential = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, RETRY_CONFIG.maxDelayMs);
  return Math.random() * capped;
};

/**
 * Attend pendant un délai calculé.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Fonction de reprise principale ────────────────────────────────────────

/**
 * Exécute une fonction asynchore avec reprise automatique.
 *
 * @param {Function} fn          - Fonction asynchrone à exécuter
 * @param {object}   [options]   - Options de reprise
 * @param {number}   [options.maxRetries=3] - Nombre max de tentatives supplémentaires
 * @param {boolean}  [options.isRetryable=true] - true → retry sur erreur
 * @returns {Promise<{success: boolean, data: any, error: Error|null, attempts: number}>}
 */
async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
  const isRetryable = options.isRetryable ?? true;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn(attempt);
      return {
        success: true,
        data,
        error: null,
        attempts: attempt + 1,
      };
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt >= maxRetries;

      console.warn(
        `[RETRY] Tentative ${attempt + 1}/${maxRetries + 1} échouée: ${err.message}`
      );

      if (isLastAttempt || !isRetryable) {
        break;
      }

      const delay = calculateDelay(attempt);
      console.warn(`[RETRY] Nouvelle tentative dans ${Math.round(delay)}ms...`);
      await wait(delay);
    }
  }

  return {
    success: false,
    data: null,
    error: lastError,
    attempts: maxRetries + 1,
  };
}

// ─── Journal des erreurs (Dead Letter Queue) ──────────────────────────────

/**
 * Enregistre une erreur dans la table error_log pour rejeu ultérieur.
 * Crée la table si elle n'existe pas.
 */
const logError = async (context, error, payload = null) => {
  const db = require('../config/db');
  const query = db.query || db;

  // Création de la table si absente
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS error_log (
        id          SERIAL PRIMARY KEY,
        context     VARCHAR(100) NOT NULL,
        error_msg   TEXT NOT NULL,
        stack_trace TEXT,
        payload     JSONB,
        status      VARCHAR(20) DEFAULT 'PENDING',
        retry_count INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
  } catch (_) { /* table déjà créée */ }

  try {
    await query(`
      INSERT INTO error_log (context, error_msg, stack_trace, payload)
      VALUES ($1, $2, $3, $4)
    `, [
      context,
      error.message || String(error),
      error.stack || null,
      payload ? JSON.stringify(payload) : null
    ]);
    console.log(`[ERROR_LOG] Erreur enregistrée dans le contexte "${context}"`);
  } catch (logErr) {
    console.error('[ERROR_LOG] Échec de l\'enregistrement de l\'erreur:', logErr.message);
  }
};

/**
 * Récupère les erreurs en attente de rejeu.
 */
const getPendingErrors = async () => {
  const db = require('../config/db');
  const result = await (db.query || db)(
    "SELECT * FROM error_log WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 50",
    []
  );
  return result.rows || [];
};

module.exports = {
  withRetry,
  logError,
  getPendingErrors,
  RETRY_CONFIG,
};
