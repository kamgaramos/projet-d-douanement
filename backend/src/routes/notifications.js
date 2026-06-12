const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { 
  obtenirMesAlertes, 
  marquerNotificationCommeLue, 
  marquerToutesCommeLues,
  marquerParTypeCommeLues,
  obtenirStatistiquesNotifications 
} = require('../controllers/notificationController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// GET /api/notifications/mes-alertes - Voir ses notifications (non lues ou toutes)
router.get('/mes-alertes', obtenirMesAlertes);

// GET /api/notifications/statistiques - Obtenir les statistiques des notifications
router.get('/statistiques', obtenirStatistiquesNotifications);

// PATCH /api/notifications/:notification_id/lu - Marquer une notification comme lue
router.patch('/:notification_id/lu', marquerNotificationCommeLue);

// PATCH /api/notifications/marquer-toutes-lues - Marquer toutes les notifications comme lues
router.patch('/marquer-toutes-lues', marquerToutesCommeLues);

// PATCH /api/notifications/type/:type/marquer-lues - Marquer les notifications d'un type comme lues
router.patch('/type/:type/marquer-lues', marquerParTypeCommeLues);

module.exports = router;