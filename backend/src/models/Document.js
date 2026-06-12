// MODÈLE DOCUMENT pour la Gestion Électronique des Documents (GED)
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
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      declaration_id INT REFERENCES declarations(id) ON DELETE CASCADE,
      nom_fichier VARCHAR(255) NOT NULL,
      type_document VARCHAR(50) NOT NULL,
      chemin_stockage VARCHAR(500) NOT NULL,
      taille_fichier BIGINT,
      mime_type VARCHAR(100),
      uploaded_by INT REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      statut VARCHAR(20) DEFAULT 'ACTIF'
    )
  `, []);

  // Index pour optimiser les recherches
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_documents_declaration_id ON documents(declaration_id);
  `, []);
  
  await executeQuery(`
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type_document);
  `, []);
};

const Document = {
  createTable,
  
  // Créer un nouveau document
  create: (data) =>
    executeQuery(
      `INSERT INTO documents (declaration_id, nom_fichier, type_document, chemin_stockage, taille_fichier, mime_type, uploaded_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        data.declaration_id, 
        data.nom_fichier, 
        data.type_document, 
        data.chemin_stockage, 
        data.taille_fichier, 
        data.mime_type, 
        data.uploaded_by
      ]
    ),

  // Récupérer tous les documents d'une déclaration
  findByDeclaration: (declaration_id) =>
    executeQuery(`
      SELECT 
        d.*,
        u.username as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.declaration_id = $1 AND d.statut = 'ACTIF'
      ORDER BY d.uploaded_at DESC
    `, [declaration_id]),

  // Récupérer un document par ID
  findById: (id) =>
    executeQuery(`
      SELECT 
        d.*,
        u.username as uploaded_by_name,
        dec.reference as declaration_reference,
        dec.declarant_id,
        dec.transitaire_id
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN declarations dec ON d.declaration_id = dec.id
      WHERE d.id = $1 AND d.statut = 'ACTIF'
    `, [id]),

  // Récupérer les documents par type
  findByType: (declaration_id, type_document) =>
    executeQuery(`
      SELECT * FROM documents 
      WHERE declaration_id = $1 AND type_document = $2 AND statut = 'ACTIF'
      ORDER BY uploaded_at DESC
    `, [declaration_id, type_document]),

  // Supprimer logiquement un document (marquer comme supprimé)
  softDelete: (id) =>
    executeQuery(`
      UPDATE documents 
      SET statut = 'SUPPRIME' 
      WHERE id = $1 
      RETURNING *
    `, [id]),

  // Mettre à jour les métadonnées d'un document
  updateMetadata: (id, nom_fichier, type_document) =>
    executeQuery(`
      UPDATE documents 
      SET nom_fichier = $1, type_document = $2 
      WHERE id = $3 
      RETURNING *
    `, [nom_fichier, type_document, id]),

  // Compter les documents par déclaration
  countByDeclaration: (declaration_id) =>
    executeQuery(`
      SELECT 
        type_document,
        COUNT(*) as count
      FROM documents 
      WHERE declaration_id = $1 AND statut = 'ACTIF'
      GROUP BY type_document
    `, [declaration_id]),

  // Vérifier la taille totale des documents pour une déclaration
  getTotalSize: (declaration_id) =>
    executeQuery(`
      SELECT 
        COALESCE(SUM(taille_fichier), 0) as taille_totale,
        COUNT(*) as nombre_fichiers
      FROM documents 
      WHERE declaration_id = $1 AND statut = 'ACTIF'
    `, [declaration_id])
};

module.exports = Document;