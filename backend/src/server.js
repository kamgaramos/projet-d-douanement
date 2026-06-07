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

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Simplifié pour le test, tu pourras restreindre après
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/declarations', declarationRoutes);
app.use('/api/marchandises', marchandiseRoutes);

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