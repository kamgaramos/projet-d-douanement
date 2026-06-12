/**
 * Point d'entrée principal du serveur backend
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
// Importation de l'objet db complet
const db = require('./config/db'); 
const { initModels } = require('./models'); 
const authRoutes = require('./routes/auth');
const declarationRoutes = require('./routes/declarations');
const marchandiseRoutes = require('./routes/marchandises');
const offreRoutes = require('./routes/offres');
const documentRoutes = require('./routes/documents');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Middlewares
app.use(cors({
  origin: '*', 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MOUCHARD DE REQUÊTES (AJOUTÉ) ---
// Ce log t'affichera chaque requête dans ton terminal VS Code
app.use((req, res, next) => {
  console.log(`[LOG] Requête reçue : ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`[LOG] Body reçu :`, JSON.stringify(req.body));
  }
  next();
});
// ------------------------------------

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/declarations', declarationRoutes);
app.use('/api/marchandises', marchandiseRoutes);
app.use('/api/offres', offreRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Initialisation du serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('\n=======================================');
    console.log('🚀 Initialisation du serveur backend');
    console.log('=======================================\n');

    // Test de connexion via l'objet db importé
    console.log('📦 Test de connexion à PostgreSQL...');
    const dbConnected = await db.testDatabaseConnection();
    
    if (!dbConnected) {
      console.warn('⚠️ Avertissement: Connexion à PostgreSQL échouée');
    } else {
      await initModels();
      console.log('✓ Base de données prête\n');
    }

    const server = app.listen(PORT, () => {
      console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Erreur lors du démarrage du serveur:', err);
    process.exit(1);
  }
};

startServer();

module.exports = app;