// MODÈLE MESSAGE pour la Messagerie
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

const createTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      sender_id INT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      read_status BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, []);

  // Index pour optimiser les recherches
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_messages_declaration_id ON messages(declaration_id);
  `, []);
  
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
  `, []);

  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(read_status);
  `, []);
};

const Message = {
  createTable,
  
  // Créer un nouveau message
  create: (data) =>
    executeQuery(
      `WITH inserted_message AS (
        INSERT INTO messages (declaration_id, sender_id, content) 
        VALUES ($1, $2, $3) 
        RETURNING *
      )
      SELECT 
        m.id,
        m.declaration_id,
        m.sender_id,
        m.content,
        m.read_status,
        m.created_at,
        m.updated_at,
        u.id as sender_id_user,
        u.username,
        u.role,
        u.email
      FROM inserted_message m
      LEFT JOIN users u ON m.sender_id = u.id`,
      [data.declaration_id, data.sender_id, data.content]
    ),

  // Récupérer tous les messages d'une déclaration (historique de conversation)
  findByDeclaration: (declaration_id) =>
    executeQuery(`
      SELECT 
        m.id,
        m.declaration_id,
        m.sender_id,
        m.content,
        m.read_status,
        m.created_at,
        u.username as sender_name,
        u.role as sender_role,
        u.email as sender_email
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.declaration_id = $1
      ORDER BY m.created_at ASC
    `, [declaration_id]),

  // Récupérer un message par ID
  findById: (id) =>
    executeQuery(`
      SELECT 
        m.*,
        u.username as sender_name,
        u.role as sender_role,
        d.reference as declaration_reference,
        d.declarant_id
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN declarations d ON m.declaration_id = d.id
      WHERE m.id = $1
    `, [id]),

  // Marquer un message comme lu
  markAsRead: (id) =>
    executeQuery(`
      UPDATE messages 
      SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `, [id]),

  // Marquer tous les messages d'une déclaration comme lus pour un utilisateur spécifique
  markAllAsReadForUser: (declaration_id, user_id) =>
    executeQuery(`
      UPDATE messages 
      SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE declaration_id = $1 AND sender_id != $2 AND read_status = FALSE
      RETURNING *
    `, [declaration_id, user_id]),

  // Compter les messages non lus pour une déclaration
  countUnreadForDeclaration: (declaration_id, user_id) =>
    executeQuery(`
      SELECT COUNT(*) as unread_count
      FROM messages 
      WHERE declaration_id = $1 AND sender_id != $2 AND read_status = FALSE
    `, [declaration_id, user_id]),

  // Compter tous les messages non lus pour un utilisateur
  countUnreadForUser: (user_id) =>
    executeQuery(`
      SELECT 
        declaration_id,
        COUNT(*) as unread_count
      FROM messages 
      WHERE sender_id != $1 AND read_status = FALSE
      GROUP BY declaration_id
    `, [user_id]),

  // Récupérer les derniers messages par déclaration pour un utilisateur
  getLastMessagesByUser: (user_id) =>
    executeQuery(`
      WITH last_messages AS (
        SELECT DISTINCT ON (m.declaration_id) 
          m.*,
          u.username as sender_name,
          u.role as sender_role,
          d.reference as declaration_reference
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN declarations d ON m.declaration_id = d.id
        WHERE d.declarant_id = $1 OR EXISTS (
          SELECT 1 FROM messages m2 
          WHERE m2.declaration_id = m.declaration_id AND m2.sender_id = $1
        )
        ORDER BY m.declaration_id, m.created_at DESC
      )
      SELECT * FROM last_messages
      ORDER BY created_at DESC
    `, [user_id]),

  // Supprimer un message (soft delete ou hard delete selon le besoin)
  delete: (id) =>
    executeQuery(`
      DELETE FROM messages 
      WHERE id = $1 
      RETURNING *
    `, [id])
};

module.exports = Message;