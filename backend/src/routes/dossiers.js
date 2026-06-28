/**
 * ROUTES DOSSIER DOUANE
 *
 * Endpoints accessibles au transitaire/déclarant pour :
 *   - Consulter ses dossiers
 *   - Soumettre les documents de dédouanement
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const {
  soumettreDeclaration,
  getDossier,
  mesDossiers,
  dossiersEnAttente,
} = require('../controllers/dossierController');

router.use(authMiddleware);

// ⚠️ ORDRE IMPORTANT : les routes statiques (sans paramètre :id) doivent
// être déclarées AVANT les routes paramétrées, sinon Express capture
// "mes-dossiers" ou "en-attente" comme un :id.

// GET /api/dossiers/mes-dossiers — Liste des dossiers du transitaire
router.get('/mes-dossiers', mesDossiers);

// GET /api/dossiers/en-attente — Liste des dossiers en attente douane
router.get('/en-attente', dossiersEnAttente);

// POST /api/dossiers/:id/soumettre — Soumettre les documents du dossier
router.post('/:id/soumettre', soumettreDeclaration);

// GET /api/dossiers/:id — Détail d'un dossier avec historique
router.get('/:id', getDossier);

module.exports = router;
