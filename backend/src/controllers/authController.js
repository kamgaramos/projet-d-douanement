const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const register = async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Champs requis manquants' });

  const normalizedRole = (role || 'declarant').toString().trim().toLowerCase();
  if (!User.validateRole(normalizedRole)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await User.create(username, email, hashed, normalizedRole);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const { rows } = await User.findByEmail(email);
    const user = rows[0];

    // --- DÉBUT LOGS DE DÉBOGAGE ---
    console.log("--- DEBUG LOGIN ---");
    console.log("Email cherché :", email);
    console.log("Utilisateur trouvé :", user ? "Oui" : "Non");
    if (user) {
        console.log("Hash en DB :", user.password);
    }
    // --- FIN LOGS ---

    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password);
    
    // --- LOGS DÉBOGAGE ---
    console.log("Résultat bcrypt.compare :", valid);
    // ---------------------

    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.username, // Utiliser 'name' pour la cohérence frontend
        username: user.username,
        email: user.email, 
        role: user.role 
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

module.exports = { register, login };