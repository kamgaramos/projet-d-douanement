const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { creerDeclaration, listerDeclarations, getDeclaration, changerStatut, accepterDeclaration, accepterOffre, supprimerDeclaration, publierDeclaration, listerMarketplace } = require('../controllers/declarationController');

router.use(authMiddleware);

router.post('/', creerDeclaration);
router.post('/publish', publierDeclaration);
router.get('/', listerDeclarations);
router.get('/marketplace', listerMarketplace);
router.get('/:id', getDeclaration);
router.patch('/:id/statut', changerStatut);
router.patch('/:id/accepter', accepterDeclaration);
router.patch('/:id/accepter-offre', accepterOffre);
router.delete('/:id', supprimerDeclaration);

module.exports = router;
