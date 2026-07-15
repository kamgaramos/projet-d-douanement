const router = require('express').Router();
const { register, login, getPendingTransitaires, validerTransitaire } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);

// Routes de validation KYC transitaires (réservées aux douaniers/admins)
router.get('/transitaires/pending', auth, getPendingTransitaires);
router.post('/transitaires/:id/valider', auth, validerTransitaire);

module.exports = router;
