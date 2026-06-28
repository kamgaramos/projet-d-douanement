/**
 * ROUTES DOUANE (Inspecteurs)
 *
 * Endpoints réservés aux douaniers pour :
 *   - Prendre une décision (Valider/Rejeter/Complément)
 *   - Consulter les dossiers
 *   - Voir l'historique des actions
 * Endpoints pour le transitaire :
 *   - Payer les taxes via e-GUCE
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const {
  actionSurDossier,
  payerDossier,
  listerDossiersDouane,
  historiqueDossier,
} = require('../controllers/douaneController');

router.use(authMiddleware);

// ─── Actions douanières ─────────────────────────────────────────────────────

// POST /api/douane/dossiers/:id/action — Décision de l'inspecteur
router.post('/dossiers/:id/action', actionSurDossier);

// GET /api/douane/dossiers — Tableau de bord de la douane (filtres: ?statut=&circuit=)
router.get('/dossiers', listerDossiersDouane);

// GET /api/douane/dossiers/:id/historique — Piste d'audit complète
router.get('/dossiers/:id/historique', historiqueDossier);

// POST /api/douane/dossiers/:id/payer — Paiement des taxes (transitaire)
router.post('/dossiers/:id/payer', payerDossier);

module.exports = router;
