// MODÈLE NOTIFICATION pour le système d'alertes
const db = require('../config/db');

/**
 * Fonction utilitaire pour exécuter les requêtes SQL
 */
const executeQuery = (text, params) => {
  if (typeof db.query === 'function') {
    return db.query(text, params);
  } else if (typeof db === 'function') {
    return db(text, params);
  } else {
    throw new Error("Impossible de trouver la méthode de requête sur le module de configuration de la base de données.");
  }
};

// Types de notifications prédéfinis
const NOTIFICATION_TYPES = {
  OFFRE_RECUE: 'OFFRE_RECUE',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  OFFRE_ACCEPTEE: 'OFFRE_ACCEPTEE',
  OFFRE_REJETEE: 'OFFRE_REJETEE',
  MESSAGE_RECU: 'MESSAGE_RECU',
  STATUT_CHANGE: 'STATUT_CHANGE',
  NOUVELLE_DECLARATION: 'NOUVELLE_DECLARATION',
  DOCUMENT_VALIDE: 'DOCUMENT_VALIDE',
  DOCUMENT_REJETE: 'DOCUMENT_REJETE'
};

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP
    )
  `, []);

  // Index pour optimiser les recherches
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  `, []);
  
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notifications_declaration_id ON notifications(declaration_id);
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
  `, []);
};

const Notification = {
  createTable,
  NOTIFICATION_TYPES,
  
  // Créer une nouvelle notification
  create: (data) =>
    executeQuery(
      `INSERT INTO notifications (user_id, declaration_id, message, type, metadata) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        data.user_id, 
        data.declaration_id, 
        data.message, 
        data.type, 
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    ),

  // Récupérer toutes les notifications d'un utilisateur
  findByUser: (user_id, limit = 50) =>
    executeQuery(`
      SELECT 
        n.*,
        d.reference as declaration_reference,
        d.port_depart,
        d.port_arrivee
      FROM notifications n
      LEFT JOIN declarations d ON n.declaration_id = d.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2
    `, [user_id, limit]),

  // Récupérer les notifications non lues d'un utilisateur
  findUnreadByUser: (user_id) =>
    executeQuery(`
      SELECT 
        n.*,
        d.reference as declaration_reference,
        d.port_depart,
        d.port_arrivee
      FROM notifications n
      LEFT JOIN declarations d ON n.declaration_id = d.id
      WHERE n.user_id = $1 AND n.is_read = FALSE
      ORDER BY n.created_at DESC
    `, [user_id]),

  // Récupérer une notification par ID
  findById: (id) =>
    executeQuery(`
      SELECT 
        n.*,
        d.reference as declaration_reference,
        u.username as user_name
      FROM notifications n
      LEFT JOIN declarations d ON n.declaration_id = d.id
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.id = $1
    `, [id]),

  // Marquer une notification comme lue
  markAsRead: (id) =>
    executeQuery(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `, [id]),

  // Marquer toutes les notifications comme lues pour un utilisateur
  markAllAsReadForUser: (user_id) =>
    executeQuery(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING *
    `, [user_id]),

  // Marquer les notifications d'un type spécifique comme lues
  markAsReadByType: (user_id, type) =>
    executeQuery(`
      UPDATE notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND type = $2 AND is_read = FALSE
      RETURNING *
    `, [user_id, type]),

  // Compter les notifications non lues pour un utilisateur
  countUnreadForUser: (user_id) =>
    executeQuery(`
      SELECT COUNT(*) as unread_count
      FROM notifications 
      WHERE user_id = $1 AND is_read = FALSE
    `, [user_id]),

  // Compter les notifications par type pour un utilisateur
  countByTypeForUser: (user_id) =>
    executeQuery(`
      SELECT 
        type,
        COUNT(*) as total_count,
        COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_count
      FROM notifications 
      WHERE user_id = $1
      GROUP BY type
      ORDER BY total_count DESC
    `, [user_id]),

  // Supprimer les anciennes notifications (nettoyage)
  deleteOldNotifications: (days = 30) =>
    executeQuery(`
      DELETE FROM notifications 
      WHERE created_at < NOW() - INTERVAL '${days} days'
      RETURNING id
    `, []),

  // Récupérer les notifications récentes pour une déclaration
  findRecentByDeclaration: (declaration_id, hours = 24) =>
    executeQuery(`
      SELECT 
        n.*,
        u.username as user_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.declaration_id = $1 
        AND n.created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY n.created_at DESC
    `, [declaration_id])
};

module.exports = Notification;