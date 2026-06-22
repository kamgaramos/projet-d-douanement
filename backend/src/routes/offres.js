const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { soumettreOffre, listerOffresParDossier, listerMesOffres } = require('../controllers/offreController');
const { executeQuery } = require('../config/db'); // On importe l'utilitaire SQL
const { creerNotification } = require('../utils/notificationHelper');

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

    // 3. Passer la déclaration en file de validation douane
    // Objectif: passer automatiquement de EN_ATTENTE_OFFRES à EN_ATTENTE_VALIDATION_DOUANE
    const updateResult = await executeQuery(
      'UPDATE declarations SET statut = $1 WHERE id = $2 RETURNING *',
      ['EN_ATTENTE_VALIDATION_DOUANE', declarationId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    // 4. Notification: prévenir tous les douaniers
    try {
      const douaniersResult = await executeQuery(
        "SELECT id FROM users WHERE role = 'douanier'"
      );
      const douaniers = douaniersResult.rows.map(r => r.id);

      const declarationReference = updateResult.rows[0].reference;
      const ancien_statut = 'EN_ATTENTE_OFFRES';
      const nouveau_statut = 'EN_ATTENTE_VALIDATION_DOUANE';

      await Promise.all(
        douaniers.map(user_id =>
          creerNotification(
            user_id,
            declarationId,
            'STATUT_CHANGE',
            `Statut de la déclaration ${declarationReference} changé de "${ancien_statut}" à "${nouveau_statut}"`,
            {
              ancien_statut,
              nouveau_statut
            }
          )
        )
      );
    } catch (notificationError) {
      // Ne pas bloquer la transition si la notification échoue
      console.error('Erreur lors de la création des notifications douaniers:', notificationError);
    }

    res.status(200).json({ message: 'Offre acceptée. Dossier en attente de validation douane.' });
  } catch (error) {
    console.error('Erreur lors de l\'acceptation :', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'acceptation' });
  }
});

module.exports = router;

