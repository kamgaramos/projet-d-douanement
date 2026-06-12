// MIDDLEWARE D'UPLOAD pour la Gestion Électronique des Documents (GED)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration du dossier d'upload
const uploadDir = path.join(__dirname, '../../uploads');

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Dossier uploads créé:', uploadDir);
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer un sous-dossier par déclaration pour organiser les fichiers
    const declarationId = req.body.declaration_id || 'temp';
    const declarationDir = path.join(uploadDir, declarationId.toString());
    
    if (!fs.existsSync(declarationDir)) {
      fs.mkdirSync(declarationDir, { recursive: true });
    }
    
    cb(null, declarationDir);
  },
  
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Nettoyer le nom de base (enlever les caractères spéciaux)
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    
    const fileName = `${cleanBaseName}_${uniqueSuffix}${extension}`;
    cb(null, fileName);
  }
});

// Filtrage des types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  // Types MIME autorisés
  const allowedMimeTypes = [
    'application/pdf',                    // PDF
    'image/jpeg',                        // JPEG
    'image/jpg',                         // JPG
    'image/png',                         // PNG
    'image/gif',                         // GIF
    'application/msword',                // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.ms-excel',          // XLS
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'text/plain',                        // TXT
    'text/csv'                          // CSV
  ];

  // Extensions autorisées (sécurité supplémentaire)
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    const error = new Error(`Type de fichier non autorisé: ${file.mimetype}. Types acceptés: PDF, Images (JPG, PNG, GIF), Documents Office (DOC, DOCX, XLS, XLSX), TXT, CSV`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Limites de taille
const limits = {
  fileSize: 10 * 1024 * 1024, // 10 MB maximum par fichier
  files: 5                     // Maximum 5 fichiers simultanément
};

// Configuration multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

// Middleware pour gérer les erreurs multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'Fichier trop volumineux',
          details: 'La taille maximale autorisée est de 10 MB par fichier'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Trop de fichiers',
          details: 'Maximum 5 fichiers peuvent être uploadés simultanément'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Champ de fichier inattendu',
          details: 'Utilisez le champ "documents" pour uploader vos fichiers'
        });
      default:
        return res.status(400).json({
          error: 'Erreur d\'upload',
          details: error.message
        });
    }
  } else if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Type de fichier non autorisé',
      details: error.message
    });
  }
  
  next(error);
};

// Types de documents autorisés avec leurs catégories
const documentTypes = {
  'facture': 'Facture commerciale',
  'bill_of_lading': 'Connaissement (B/L)',
  'packing_list': 'Liste de colisage',
  'certificate_origin': 'Certificat d\'origine',
  'insurance': 'Police d\'assurance',
  'invoice': 'Facture proforma',
  'customs_declaration': 'Déclaration en douane',
  'transport_document': 'Document de transport',
  'quality_certificate': 'Certificat de qualité',
  'other': 'Autre document'
};

// Fonction utilitaire pour valider le type de document
const validateDocumentType = (type) => {
  return Object.keys(documentTypes).includes(type);
};

// Middleware de validation des métadonnées
const validateUploadData = (req, res, next) => {
  const { declaration_id, type_document } = req.body;

  if (!declaration_id || isNaN(parseInt(declaration_id))) {
    return res.status(400).json({
      error: 'Données invalides',
      details: 'declaration_id est requis et doit être un nombre entier'
    });
  }

  if (!type_document || !validateDocumentType(type_document)) {
    return res.status(400).json({
      error: 'Type de document invalide',
      details: `Types autorisés: ${Object.keys(documentTypes).join(', ')}`
    });
  }

  req.body.declaration_id = parseInt(declaration_id);
  next();
};

module.exports = {
  upload,
  handleMulterError,
  validateUploadData,
  documentTypes,
  validateDocumentType
};