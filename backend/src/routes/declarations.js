const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { creerDeclaration, listerDeclarations, getDeclaration, changerStatut, supprimerDeclaration, publierDeclaration, listerMarketplace } = require('../controllers/declarationController');

router.use(authMiddleware);

router.post('/', creerDeclaration);
router.post('/publish', publierDeclaration);
router.get('/', listerDeclarations);
router.get('/marketplace', listerMarketplace);
router.get('/:id', getDeclaration);
router.patch('/:id/statut', changerStatut);
router.delete('/:id', supprimerDeclaration);

module.exports = router;
