const Notification = require('../models/Notification');

const obtenirMesAlertes = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { limit = 50, unread_only = 'false', declaration_id } = req.query;

    // Validation des paramètres
    const limitInt = parseInt(limit);
    if (isNaN(limitInt) || limitInt <= 0 || limitInt > 100) {
      return res.status(400).json({
        error: 'Paramètre limit invalide',
        details: 'limit doit être un nombre entre 1 et 100'
      });
    }

    // Récupérer les notifications selon le filtre
    let notificationsResult;
    if (declaration_id) {
      const declId = parseInt(declaration_id);
      if (isNaN(declId)) {
        return res.status(400).json({ error: 'declaration_id doit être un nombre' });
      }
      notificationsResult = await Notification.findByDeclaration(declId, user_id, limitInt);
    } else if (unread_only === 'true') {
      notificationsResult = await Notification.findUnreadByUser(user_id);
    } else {
      notificationsResult = await Notification.findByUser(user_id, limitInt);
    }

    const notifications = notificationsResult.rows;

    // Récupérer les statistiques
    const unreadCountResult = await Notification.countUnreadForUser(user_id);
    const unreadCount = unreadCountResult.rows[0]?.unread_count || 0;

    const countsByTypeResult = await Notification.countByTypeForUser(user_id);
    const countsByType = countsByTypeResult.rows;

    res.status(200).json({
      message: 'Notifications récupérées avec succès',
      statistiques: {
        total_notifications: notifications.length,
        non_lues: parseInt(unreadCount),
        repartition_par_type: countsByType
      },
      notifications: notifications.map(notif => ({
        id: notif.id,
        message: notif.message,
        type: notif.type,
        is_read: notif.is_read,
        created_at: notif.created_at,
        read_at: notif.read_at,
        declaration: {
          id: notif.declaration_id,
          reference: notif.declaration_reference,
          port_depart: notif.port_depart,
          port_arrivee: notif.port_arrivee
        },
        metadata: notif.metadata ? JSON.parse(notif.metadata) : null
      }))
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des notifications',
      details: error.message
    });
  }
};

const marquerNotificationCommeLue = async (req, res) => {
  try {
    const { notification_id } = req.params;
    const user_id = req.user.id;

    // Validation du paramètre
    if (isNaN(parseInt(notification_id))) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        details: 'notification_id doit être un nombre entier'
      });
    }

    // Récupérer la notification
    const notificationResult = await Notification.findById(notification_id);
    if (notificationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification non trouvée'
      });
    }

    const notification = notificationResult.rows[0];

    // Vérifier que l'utilisateur est le propriétaire de la notification
    if (notification.user_id !== user_id) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous ne pouvez marquer comme lue que vos propres notifications'
      });
    }

    // Marquer comme lue
    const updatedResult = await Notification.markAsRead(notification_id);
    const updatedNotification = updatedResult.rows[0];

    res.status(200).json({
      message: 'Notification marquée comme lue',
      notification: {
        id: updatedNotification.id,
        is_read: updatedNotification.is_read,
        read_at: updatedNotification.read_at
      }
    });

  } catch (error) {
    console.error('Erreur lors du marquage de la notification:', error);
    res.status(500).json({
      error: 'Erreur serveur lors du marquage',
      details: error.message
    });
  }
};

const marquerToutesCommeLues = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Marquer toutes les notifications comme lues
    const updatedResult = await Notification.markAllAsReadForUser(user_id);
    const updatedNotifications = updatedResult.rows;

    res.status(200).json({
      message: `${updatedNotifications.length} notification(s) marquée(s) comme lues`,
      notifications_mises_a_jour: updatedNotifications.length
    });

  } catch (error) {
    console.error('Erreur lors du marquage en masse:', error);
    res.status(500).json({
      error: 'Erreur serveur lors du marquage en masse',
      details: error.message
    });
  }
};

const marquerParTypeCommeLues = async (req, res) => {
  try {
    const { type } = req.params;
    const user_id = req.user.id;

    // Vérifier que le type est valide
    if (!Object.values(Notification.NOTIFICATION_TYPES).includes(type)) {
      return res.status(400).json({
        error: 'Type de notification invalide',
        details: `Types valides: ${Object.values(Notification.NOTIFICATION_TYPES).join(', ')}`
      });
    }

    // Marquer les notifications de ce type comme lues
    const updatedResult = await Notification.markAsReadByType(user_id, type);
    const updatedNotifications = updatedResult.rows;

    res.status(200).json({
      message: `${updatedNotifications.length} notification(s) de type "${type}" marquée(s) comme lues`,
      type: type,
      notifications_mises_a_jour: updatedNotifications.length
    });

  } catch (error) {
    console.error('Erreur lors du marquage par type:', error);
    res.status(500).json({
      error: 'Erreur serveur lors du marquage par type',
      details: error.message
    });
  }
};

const obtenirStatistiquesNotifications = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Récupérer les compteurs généraux
    const unreadCountResult = await Notification.countUnreadForUser(user_id);
    const unreadCount = unreadCountResult.rows[0]?.unread_count || 0;

    const countsByTypeResult = await Notification.countByTypeForUser(user_id);
    const countsByType = countsByTypeResult.rows;

    // Calculer le total de toutes les notifications
    const totalNotifications = countsByType.reduce((sum, type) => sum + parseInt(type.total_count), 0);

    // Préparer les statistiques par type avec descriptions
    const typeDescriptions = {
      'OFFRE_RECUE': 'Offres reçues',
      'DOCUMENT_UPLOADED': 'Documents uploadés',
      'OFFRE_ACCEPTEE': 'Offres acceptées',
      'OFFRE_REJETEE': 'Offres rejetées',
      'MESSAGE_RECU': 'Messages reçus',
      'STATUT_CHANGE': 'Changements de statut',
      'NOUVELLE_DECLARATION': 'Nouvelles déclarations',
      'DOCUMENT_VALIDE': 'Documents validés',
      'DOCUMENT_REJETE': 'Documents rejetés'
    };

    const statistiquesParType = countsByType.map(type => ({
      type: type.type,
      description: typeDescriptions[type.type] || type.type,
      total: parseInt(type.total_count),
      non_lues: parseInt(type.unread_count),
      pourcentage_total: totalNotifications > 0 ? Math.round((parseInt(type.total_count) / totalNotifications) * 100) : 0
    }));

    res.status(200).json({
      message: 'Statistiques des notifications récupérées avec succès',
      resume: {
        total_notifications: totalNotifications,
        non_lues: parseInt(unreadCount),
        pourcentage_non_lues: totalNotifications > 0 ? Math.round((parseInt(unreadCount) / totalNotifications) * 100) : 0
      },
      par_type: statistiquesParType
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des statistiques',
      details: error.message
    });
  }
};

module.exports = {
  obtenirMesAlertes,
  marquerNotificationCommeLue,
  marquerToutesCommeLues,
  marquerParTypeCommeLues,
  obtenirStatistiquesNotifications
};