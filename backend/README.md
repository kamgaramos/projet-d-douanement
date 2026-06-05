# Plateforme B2B de Dédouanement de Marchandises - Backend

## 📋 Description

Backend REST API développé avec **Node.js/Express** et **PostgreSQL** pour la gestion des opérations de dédouanement B2B.

## 🚀 Démarrage rapide

### Prérequis
- Node.js (v16+)
- PostgreSQL (v12+)
- npm ou yarn

### Installation

1. **Cloner et naviguer vers le dossier backend**
```bash
cd backend
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```bash
cp .env.example .env
```
Éditez le fichier `.env` avec vos paramètres PostgreSQL et autres configurations.

4. **Créer la base de données PostgreSQL**
```bash
createdb dedouanement_db
```

### Démarrage du serveur

**Mode développement** (avec rechargement automatique):
```bash
npm run dev
```

**Mode production**:
```bash
npm start
```

Le serveur sera disponible sur: `http://localhost:5000`

## 📁 Structure du projet

```
backend/
├── src/
│   ├── config/
│   │   └── db.js              # Configuration PostgreSQL
│   └── server.js              # Point d'entrée principal
├── package.json               # Dépendances du projet
├── .env.example               # Exemple de variables d'environnement
├── .gitignore                 # Fichiers à ignorer par Git
└── README.md                  # Ce fichier
```

## 🔌 API Endpoints

### Health Check
- **GET** `/api/health` - Vérifie le statut du serveur
  ```json
  {
    "status": "UP",
    "timestamp": "2026-06-04T10:30:00.000Z",
    "service": "Dedouanement Platform Backend",
    "version": "1.0.0"
  }
  ```

### Bienvenue
- **GET** `/` - Message de bienvenue

## 📦 Dépendances principales

| Package | Version | Rôle |
|---------|---------|------|
| express | ^4.18.2 | Framework Web |
| pg | ^8.10.0 | Client PostgreSQL |
| bcrypt | ^5.1.1 | Hachage sécurisé des mots de passe |
| jsonwebtoken | ^9.1.2 | Authentification JWT |
| cors | ^2.8.5 | Gestion CORS |
| dotenv | ^16.3.1 | Variables d'environnement |
| nodemon | ^3.0.1 | Rechargement automatique (dev) |

## 🔐 Configuration de sécurité

- **CORS**: Configuré pour accepter les requêtes cross-origin (à adapter en production)
- **JWT**: Utilisé pour l'authentification stateless
- **Bcrypt**: Pour le hachage sécurisé des mots de passe
- **dotenv**: Gestion sécurisée des variables sensibles

## 📝 Prochaines étapes

1. Créer les modèles de données (tables PostgreSQL)
2. Développer les contrôleurs et services
3. Implémenter l'authentification JWT
4. Ajouter les validations des données
5. Configurer les logs centralisés
6. Implémenter les tests unitaires

## 📞 Support

Pour toute question ou problème, veuillez créer une issue dans le dépôt.

---
**Plateforme B2B de Dédouanement** - MVP 2026
