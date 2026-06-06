/**
 * Point d'entrée principal du serveur backend
 * Initialise Express, les middlewares et la connexion à la base de données
 */

// ===============================
// Chargement des variables d'environnement
// ===============================
require('dotenv').config();

// ===============================
// Imports des dépendances
// ===============================
const express = require('express');
const cors = require('cors');
const { testDatabaseConnection } = require('./config/db');
const { initModels } = require('./models');
const authRoutes = require('./routes/auth');
const declarationRoutes = require('./routes/declarations');
const marchandiseRoutes = require('./routes/marchandises');

// ===============================
// Initialisation de l'application Express
// ===============================
const app = express();

// ===============================
// Configuration des middlewares globaux
// ===============================

// CORS - Configuration robuste pour gérer les chaînes ou les listes d'origines
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:4200'];

app.use(cors({
  origin: function (origin, callback) {
    // Permet les requêtes sans origine (comme Postman ou les outils mobiles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par la politique CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware pour parser les JSON
app.use(express.json());

// Middleware pour parser les données URL-encoded
app.use(express.urlencoded({ extended: true }));

// ===============================
// Routes
// ===============================
app.use('/api/auth', authRoutes);
app.use('/api/declarations', declarationRoutes);
app.use('/api/declarations', marchandiseRoutes);

/**
 * Route de vérification de santé (Health Check)
 * Retourne le statut du serveur
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Dedouanement Platform Backend',
    version: '1.0.0',
  });
});

// Route racine (optionnelle)
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Dedouanement Platform Backend',
    api_version: '1.0.0',
    endpoints: {
      health: '/api/health',
    },
  });
});

// Gestion des routes non trouvées (404)
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// ===============================
// Gestion des erreurs globales
// ===============================
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
  });
});

// ===============================
// Initialisation du serveur
// ===============================
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = async () => {
  try {
    console.log('\n=======================================');
    console.log('🚀 Initialisation du serveur backend');
    console.log('=======================================\n');

    // Test de connexion à la base de données
    console.log('📦 Test de connexion à PostgreSQL...');
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.warn('⚠️  Avertissement: Impossible de se connecter à PostgreSQL');
      console.warn('   Le serveur démarrera quand même, mais les fonctionnalités DB seront indisponibles\n');
    } else {
      await initModels();
      console.log('✓ Base de données prête\n');
    }

    // Démarrage du serveur HTTP
    const server = app.listen(PORT, () => {
      console.log(`✓ Serveur démarré avec succès`);
      console.log(`   📍 URL: http://localhost:${PORT}`);
      console.log(`   🔧 Environnement: ${NODE_ENV}`);
      console.log('\n✓ Routes disponibles:');
      console.log(`   - GET  /              (Bienvenue)`);
      console.log(`   - GET  /api/health    (Health Check)\n`);
    });

    // Gestion du shutdown gracieux
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Arrêt du serveur...');
      server.close(() => {
        console.log('✓ Serveur arrêté avec succès');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ Erreur lors du démarrage du serveur:', err);
    process.exit(1);
  }
};

// Lancement du serveur
startServer();

module.exports = app;