const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { creerDeclaration, listerDeclarations, getDeclaration, changerStatut } = require('../controllers/declarationController');

router.use(authMiddleware);

router.post('/', creerDeclaration);
router.get('/', listerDeclarations);
router.get('/:id', getDeclaration);
router.patch('/:id/statut', changerStatut);

module.exports = router;
