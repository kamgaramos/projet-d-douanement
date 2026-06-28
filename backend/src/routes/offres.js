/**
 * ROUTES OFFRE
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const {
  soumettreOffre,
  accepterOffre,
  rejeterOffre,
  listerOffresParDossier,
  listerMesOffres
} = require('../controllers/offreController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// POST /api/offres/soumettre — Soumettre une offre
router.post('/soumettre', soumettreOffre);

// POST /api/offres/:id/accepter — Accepter une offre (avec optimistic locking)
router.post('/:id/accepter', accepterOffre);

// POST /api/offres/:id/rejeter — Rejeter une offre
router.post('/:id/rejeter', rejeterOffre);

// GET /api/offres/dossier/:declaration_id — Offres d'une déclaration
router.get('/dossier/:declaration_id', listerOffresParDossier);

// GET /api/offres/mes-offres — Offres du transitaire connecté
router.get('/mes-offres', listerMesOffres);

module.exports = router;
