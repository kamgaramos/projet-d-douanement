// UTILITAIRE DE NOTIFICATIONS
const Notification = require('../models/Notification');

/**
 * Créer une notification pour un utilisateur
 * @param {number} user_id - ID de l'utilisateur destinataire
 * @param {number} declaration_id - ID de la déclaration concernée
 * @param {string} type - Type de notification (voir NOTIFICATION_TYPES)
 * @param {string} message - Message de la notification
 * @param {object} metadata - Données supplémentaires (optionnel)
 * @returns {Promise} Résultat de la création
 */
const creerNotification = async (user_id, declaration_id, type, message, metadata = null) => {
  try {
    // Validation des paramètres obligatoires
    if (!user_id || !declaration_id || !type || !message) {
      throw new Error('Paramètres manquants pour créer la notification');
    }

    // Vérifier que le type de notification est valide
    if (!Object.values(Notification.NOTIFICATION_TYPES).includes(type)) {
      throw new Error(`Type de notification invalide: ${type}`);
    }

    const notificationData = {
      user_id,
      declaration_id,
      type,
      message,
      metadata
    };

    const result = await Notification.create(notificationData);
    console.log(`📢 Notification créée: ${type} pour utilisateur ${user_id}`);
    
    return result.rows[0];
  } catch (error) {
    console.error('Erreur lors de la création de notification:', error);
    throw error;
  }
};

/**
 * Créer des notifications multiples pour différents utilisateurs
 * @param {Array} notifications - Tableau d'objets notification
 * @returns {Promise} Résultats des créations
 */
const creerNotificationsMultiples = async (notifications) => {
  try {
    const results = [];
    
    for (const notif of notifications) {
      const result = await creerNotification(
        notif.user_id,
        notif.declaration_id,
        notif.type,
        notif.message,
        notif.metadata
      );
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Erreur lors de la création de notifications multiples:', error);
    throw error;
  }
};

/**
 * Templates de messages prédéfinis pour différents types de notifications
 */
const MESSAGE_TEMPLATES = {
  OFFRE_RECUE: (transitaire_name, montant) => 
    `Nouvelle offre reçue de ${transitaire_name} pour un montant de ${montant}€`,
  
  DOCUMENT_UPLOADED: (document_type, uploader_name) => 
    `Nouveau document uploadé (${document_type}) par ${uploader_name}`,
  
  OFFRE_ACCEPTEE: (declaration_reference) => 
    `Votre offre pour la déclaration ${declaration_reference} a été acceptée`,
  
  OFFRE_REJETEE: (declaration_reference) => 
    `Votre offre pour la déclaration ${declaration_reference} a été rejetée`,
  
  MESSAGE_RECU: (sender_name) => 
    `Nouveau message reçu de ${sender_name}`,
  
  STATUT_CHANGE: (ancien_statut, nouveau_statut) => 
    `Statut de votre déclaration changé de "${ancien_statut}" à "${nouveau_statut}"`,
  
  NOUVELLE_DECLARATION: (declaration_reference, port_arrivee) => 
    `Nouvelle déclaration disponible ${declaration_reference} vers ${port_arrivee}`,
  
  DOCUMENT_VALIDE: (document_type) => 
    `Votre document ${document_type} a été validé par la douane`,
  
  DOCUMENT_REJETE: (document_type, raison) => 
    `Votre document ${document_type} a été rejeté: ${raison}`
};

/**
 * Créer une notification avec un template prédéfini
 * @param {number} user_id 
 * @param {number} declaration_id 
 * @param {string} type 
 * @param {object} templateData - Données pour le template
 * @param {object} metadata 
 */
const creerNotificationAvecTemplate = async (user_id, declaration_id, type, templateData = {}, metadata = null) => {
  try {
    const template = MESSAGE_TEMPLATES[type];
    if (!template) {
      throw new Error(`Template non trouvé pour le type: ${type}`);
    }

    // Générer le message avec le template
    const message = template(...Object.values(templateData));
    
    return await creerNotification(user_id, declaration_id, type, message, metadata);
  } catch (error) {
    console.error('Erreur avec template de notification:', error);
    throw error;
  }
};

/**
 * Notifier tous les participants d'une déclaration
 * @param {number} declaration_id 
 * @param {string} type 
 * @param {string} message 
 * @param {number} exclude_user_id - Utilisateur à exclure (ex: celui qui fait l'action)
 * @param {object} metadata 
 */
const notifierParticipantsDeclaration = async (declaration_id, type, message, exclude_user_id = null, metadata = null) => {
  try {
    const Declaration = require('../models/Declaration');
    
    // Récupérer les infos de la déclaration pour identifier les participants
    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      throw new Error('Déclaration non trouvée');
    }

    const declaration = declarationResult.rows[0];
    const participants = [declaration.declarant_id];

    // TODO: Ajouter les transitaires participants si nécessaire
    // Filtrer l'utilisateur à exclure
    const usersToNotify = participants.filter(userId => userId !== exclude_user_id);

    // Créer les notifications pour tous les participants
    const notifications = usersToNotify.map(userId => ({
      user_id: userId,
      declaration_id,
      type,
      message,
      metadata
    }));

    return await creerNotificationsMultiples(notifications);
  } catch (error) {
    console.error('Erreur lors de la notification des participants:', error);
    throw error;
  }
};

module.exports = {
  creerNotification,
  creerNotificationsMultiples,
  creerNotificationAvecTemplate,
  notifierParticipantsDeclaration,
  MESSAGE_TEMPLATES,
  NOTIFICATION_TYPES: Notification.NOTIFICATION_TYPES
};