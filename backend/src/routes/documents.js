const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { upload, handleMulterError, validateUploadData } = require('../middleware/upload');
const { 
  uploadDocuments, 
  listerDocuments, 
  telechargerDocument, 
  supprimerDocument 
} = require('../controllers/documentController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// POST /api/documents/upload - Upload de documents
router.post('/upload',
  upload.array('documents', 5), // Champ 'documents', max 5 fichiers — DOIT être AVANT la validation
  handleMulterError,
  validateUploadData, // Validation APRÈS que Multer a parsé le FormData
  uploadDocuments
);

// GET /api/documents/declaration/:declaration_id - Lister les documents d'une déclaration
router.get('/declaration/:declaration_id', listerDocuments);

// GET /api/documents/download/:document_id - Télécharger un document
router.get('/download/:document_id', telechargerDocument);

// DELETE /api/documents/:document_id - Supprimer un document
router.delete('/:document_id', supprimerDocument);

module.exports = router;