const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { ajouterMarchandise, listerMarchandises, supprimerMarchandise } = require('../controllers/marchandiseController');

router.use(authMiddleware);

router.post('/:declaration_id/marchandises', ajouterMarchandise);
router.get('/:declaration_id/marchandises', listerMarchandises);
router.delete('/marchandises/:id', supprimerMarchandise);

module.exports = router;
