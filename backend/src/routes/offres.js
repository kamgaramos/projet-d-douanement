const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { soumettreOffre, listerOffresParDossier, listerMesOffres } = require('../controllers/offreController');
const { executeQuery } = require('../config/db'); // On importe l'utilitaire SQL

// Toutes les routes des offres nécessitent une authentification
router.use(authMiddleware);

// POST /api/offres/soumettre - Soumettre une nouvelle offre
router.post('/soumettre', soumettreOffre);

// GET /api/offres/dossier/:declaration_id - Lister les offres pour une déclaration
router.get('/dossier/:declaration_id', listerOffresParDossier);

// GET /api/offres/mes-offres - Lister les offres du transitaire connecté
router.get('/mes-offres', listerMesOffres);

// PATCH /api/offres/:id/accepter - Accepter une offre et verrouiller le dossier
router.patch('/:id/accepter', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Mise à jour statut de l'offre
    await executeQuery('UPDATE offres SET statut = $1 WHERE id = $2', ['ACCEPTEE', id]);

    // 2. Récupérer la déclaration liée
    const result = await executeQuery('SELECT declaration_id FROM offres WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Offre non trouvée' });
    
    const declarationId = result.rows[0].declaration_id;

    // 3. Passer la déclaration en 'EN_COURS'
    await executeQuery('UPDATE declarations SET statut = $1 WHERE id = $2', ['EN_COURS', declarationId]);

    res.status(200).json({ message: 'Offre acceptée. Dossier en cours de traitement.' });
  } catch (error) {
    console.error('Erreur lors de l\'acceptation :', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'acceptation' });
  }
});

module.exports = router;