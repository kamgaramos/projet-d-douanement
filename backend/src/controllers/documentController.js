const Document = require('../models/Document');
const Declaration = require('../models/Declaration');
const path = require('path');
const fs = require('fs');

const uploadDocuments = async (req, res) => {
  try {
    const { declaration_id, type_document } = req.body;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Vérifier que des fichiers ont été uploadés
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'Aucun fichier fourni',
        details: 'Veuillez sélectionner au moins un fichier à uploader'
      });
    }

    // Vérifier que la déclaration existe
    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      // Supprimer les fichiers uploadés si la déclaration n'existe pas
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      
      return res.status(404).json({
        error: 'Déclaration non trouvée',
        details: 'La déclaration spécifiée n\'existe pas'
      });
    }

    const declaration = declarationResult.rows[0];

    // Vérifier les permissions d'upload
    const canUpload = (
      user_role === 'admin' ||
      user_role === 'douanier' ||
      declaration.declarant_id === user_id ||
      declaration.transitaire_id === user_id
    );

    if (!canUpload) {
      // Supprimer les fichiers uploadés si pas d'autorisation
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous n\'êtes pas autorisé à uploader des documents pour cette déclaration'
      });
    }

    // Traiter chaque fichier uploadé
    const documentsCreated = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const documentData = {
          declaration_id,
          nom_fichier: file.originalname,
          type_document,
          chemin_stockage: file.path,
          taille_fichier: file.size,
          mime_type: file.mimetype,
          uploaded_by: user_id
        };

        const documentResult = await Document.create(documentData);
        const newDocument = documentResult.rows[0];

        documentsCreated.push({
          id: newDocument.id,
          nom_fichier: newDocument.nom_fichier,
          type_document: newDocument.type_document,
          taille_fichier: newDocument.taille_fichier,
          uploaded_at: newDocument.uploaded_at
        });

      } catch (dbError) {
        console.error('Erreur DB pour le fichier', file.originalname, ':', dbError);
        errors.push({
          fichier: file.originalname,
          erreur: 'Erreur lors de l\'enregistrement en base de données'
        });

        // Supprimer le fichier en cas d'erreur DB
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    // Préparer la réponse
    const response = {
      message: `${documentsCreated.length} document(s) uploadé(s) avec succès`,
      declaration_id,
      declaration_reference: declaration.reference,
      documents_created: documentsCreated
    };

    if (errors.length > 0) {
      response.erreurs = errors;
      response.message += `, ${errors.length} erreur(s)`;
    }

    const statusCode = errors.length > 0 ? 207 : 201; // 207 Multi-Status si erreurs partielles
    res.status(statusCode).json(response);

  } catch (error) {
    console.error('Erreur lors de l\'upload de documents:', error);

    // Nettoyer les fichiers en cas d'erreur générale
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      error: 'Erreur serveur lors de l\'upload',
      details: error.message
    });
  }
};

const listerDocuments = async (req, res) => {
  try {
    const { declaration_id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Validation du paramètre
    if (isNaN(parseInt(declaration_id))) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        details: 'declaration_id doit être un nombre entier'
      });
    }

    // Vérifier que la déclaration existe
    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Déclaration non trouvée'
      });
    }

    const declaration = declarationResult.rows[0];

    // Vérifier les permissions de lecture
    const canView = (
      user_role === 'admin' ||
      user_role === 'douanier' ||
      declaration.declarant_id === user_id ||
      declaration.transitaire_id === user_id
    );

    if (!canView) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous n\'êtes pas autorisé à voir les documents de cette déclaration'
      });
    }

    // Récupérer les documents
    const documentsResult = await Document.findByDeclaration(declaration_id);
    const documents = documentsResult.rows;

    // Récupérer les statistiques
    const statsResult = await Document.countByDeclaration(declaration_id);
    const totalSizeResult = await Document.getTotalSize(declaration_id);

    res.status(200).json({
      message: 'Documents récupérés avec succès',
      declaration: {
        id: declaration.id,
        reference: declaration.reference,
        statut: declaration.statut
      },
      statistiques: {
        total_documents: documents.length,
        taille_totale_bytes: totalSizeResult.rows[0]?.taille_totale || 0,
        repartition_par_type: statsResult.rows
      },
      documents: documents.map(doc => ({
        id: doc.id,
        nom_fichier: doc.nom_fichier,
        type_document: doc.type_document,
        taille_fichier: doc.taille_fichier,
        mime_type: doc.mime_type,
        uploaded_by_name: doc.uploaded_by_name,
        uploaded_at: doc.uploaded_at
      }))
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des documents',
      details: error.message
    });
  }
};

const telechargerDocument = async (req, res) => {
  try {
    const { document_id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Récupérer le document
    const documentResult = await Document.findById(document_id);
    if (documentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Document non trouvé'
      });
    }

    const document = documentResult.rows[0];

    // Vérifier les permissions
    const canDownload = (
      user_role === 'admin' ||
      user_role === 'douanier' ||
      document.declarant_id === user_id ||
      document.transitaire_id === user_id
    );

    if (!canDownload) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous n\'êtes pas autorisé à télécharger ce document'
      });
    }

    // Vérifier que le fichier existe
    const filePath = document.chemin_stockage;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Fichier non trouvé',
        details: 'Le fichier physique n\'existe plus sur le serveur'
      });
    }

    // Définir les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${document.nom_fichier}"`);
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Length', document.taille_fichier);

    // Envoyer le fichier
    res.sendFile(path.resolve(filePath));

  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors du téléchargement',
      details: error.message
    });
  }
};

const supprimerDocument = async (req, res) => {
  try {
    const { document_id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Récupérer le document
    const documentResult = await Document.findById(document_id);
    if (documentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Document non trouvé'
      });
    }

    const document = documentResult.rows[0];

    // Vérifier les permissions (seul le propriétaire ou admin peut supprimer)
    const canDelete = (
      user_role === 'admin' ||
      (document.declarant_id === user_id && document.uploaded_by === user_id)
    );

    if (!canDelete) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous n\'êtes pas autorisé à supprimer ce document'
      });
    }

    // Suppression logique en base de données
    await Document.softDelete(document_id);

    // TODO: Optionnel - Supprimer physiquement le fichier après un délai
    // Pour l'instant, on garde le fichier physique pour sécurité

    res.status(200).json({
      message: 'Document supprimé avec succès',
      document_id: document_id,
      nom_fichier: document.nom_fichier
    });

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la suppression',
      details: error.message
    });
  }
};

module.exports = {
  uploadDocuments,
  listerDocuments,
  telechargerDocument,
  supprimerDocument
};