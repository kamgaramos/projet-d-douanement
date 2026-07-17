const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const db = require('../config/db');

const register = async (req, res) => {
  const { username, email, password, role, num_agrement } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Champs requis manquants' });

  const normalizedRole = (role || 'declarant').toString().trim().toLowerCase();
  if (!User.validateRole(normalizedRole)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  // Si le rôle est transitaire, l'agrément en douane est requis
  if (normalizedRole === 'transitaire' && (!num_agrement || !num_agrement.trim())) {
    return res.status(400).json({ 
      error: 'Agrément requis', 
      message: 'Le numéro d\'agrément est obligatoire pour s\'inscrire en tant que transitaire.' 
    });
  }

  // Les transitaires s'inscrivent avec le statut 'PENDING' (validation requise par la douane)
  const statut_validation = normalizedRole === 'transitaire' ? 'PENDING' : 'APPROVED';

  try {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await User.create(
      username,
      email,
      hashed,
      normalizedRole,
      statut_validation,
      normalizedRole === 'transitaire' ? num_agrement.trim() : null
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("ERREUR DETECTEE : ", error);
    console.error("STACK :", error?.stack);

    // logs utiles pour diagnostiquer rapidement en prod/Railway
    console.error("PAYLOAD REGISTER:", {
      username,
      email,
      role: normalizedRole,
      num_agrement: normalizedRole === 'transitaire' ? num_agrement : undefined,
    });

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    return res.status(500).json({
      error: 'Erreur serveur lors de l\'inscription',
      details: error?.message,
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    console.log("Email normalisé :", normalizedEmail);
    const { rows } = await User.findByEmail(normalizedEmail);
    const user = rows[0];

    console.log("--- DEBUG LOGIN ---");
    console.log("Email cherché :", email);
    console.log("Utilisateur trouvé :", user ? "Oui" : "Non");

    if (!user) return res.status(401).json({ error: 'Identifiants invalides', message: 'Email ou mot de passe incorrect.' });

    // Bloquer la connexion si le compte transitaire est en attente de validation (KYC)
    if (user.role === 'transitaire' && user.statut_validation === 'PENDING') {
      return res.status(403).json({
        error: 'Compte en attente de validation',
        message: 'Votre compte transitaire est en cours de validation par l\'administration de la douane. Veuillez réessayer ultérieurement.'
      });
    }

    // Bloquer la connexion si le compte transitaire a été rejeté
    if (user.role === 'transitaire' && user.statut_validation === 'REJECTED') {
      return res.status(403).json({
        error: 'Compte rejeté',
        message: 'Votre compte transitaire a été rejeté par l\'administration de la douane. Veuillez contacter le support.'
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    console.log("Résultat bcrypt.compare :", valid);

    if (!valid) return res.status(401).json({ error: 'Identifiants invalides', message: 'Email ou mot de passe incorrect.' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.username,
        username: user.username,
        email: user.email, 
        role: user.role,
        statut_validation: user.statut_validation,
        num_agrement: user.num_agrement
      },
      message: 'Connexion réussie'
    });
  } catch (err) {
    console.error("Erreur serveur détaillée lors de la connexion:", err);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la connexion',
      message: err.message 
    });
  }
};

const getPendingTransitaires = async (req, res) => {
  try {
    if (req.user.role !== 'douanier' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit', message: 'Seul le service douanier ou un administrateur peut accéder à cette liste.' });
    }

    const { rows } = await db.query(
      "SELECT id, username, email, num_agrement, created_at FROM users WHERE role = 'transitaire' AND statut_validation = 'PENDING' ORDER BY created_at DESC"
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des transitaires', details: error.message });
  }
};

const validerTransitaire = async (req, res) => {
  try {
    if (req.user.role !== 'douanier' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit', message: 'Seul le service douanier ou un administrateur peut valider un transitaire.' });
    }

    const { id } = req.params;
    const { action } = req.body;

    if (action !== 'APPROVED' && action !== 'REJECTED') {
      return res.status(400).json({ error: 'Action invalide', message: 'L\'action doit être APPROVED ou REJECTED.' });
    }

    const result = await db.query(
      'UPDATE users SET statut_validation = $1 WHERE id = $2 AND role = $3 RETURNING id, username, email, role, statut_validation',
      [action, id, 'transitaire']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transitaire introuvable', message: 'Aucun transitaire en attente trouvé avec cet identifiant.' });
    }

    res.status(200).json({ message: `Compte transitaire ${action === 'APPROVED' ? 'approuvé' : 'rejeté'} avec succès.`, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la validation du transitaire', details: error.message });
  }
};

module.exports = { register, login, getPendingTransitaires, validerTransitaire };