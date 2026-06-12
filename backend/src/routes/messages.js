const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { 
  envoyerMessage, 
  obtenirHistoriqueMessages, 
  marquerMessageCommeLu,
  obtenirResumeMesConversations 
} = require('../controllers/messageController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// POST /api/messages/envoyer - Envoyer un message sur un dossier
router.post('/envoyer', envoyerMessage);

// GET /api/messages/dossier/:declaration_id - Récupérer l'historique des échanges pour un dossier
router.get('/dossier/:declaration_id', obtenirHistoriqueMessages);

// PATCH /api/messages/:message_id/lu - Marquer un message comme lu
router.patch('/:message_id/lu', marquerMessageCommeLu);

// GET /api/messages/mes-conversations - Obtenir un résumé de toutes les conversations
router.get('/mes-conversations', obtenirResumeMesConversations);

module.exports = router;