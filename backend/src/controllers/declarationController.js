const { Declaration } = require('../models');

const creerDeclaration = async (req, res) => {
  const reference = `DEC-${Date.now()}`;
  try {
    const { rows } = await Declaration.create(reference, req.user.id);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listerDeclarations = async (req, res) => {
  try {
    const { id, role } = req.user;
    let rows;

    if (role === 'douanier' || role === 'admin') {
      // Accès total : récupère toutes les déclarations toutes origines confondues
      ({ rows } = await Declaration.findAll());
    } else {
      // Accès restreint : le déclarant ne voit que ses propres déclarations
      ({ rows } = await Declaration.findByDeclarant(id));
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDeclaration = async (req, res) => {
  try {
    const { rows } = await Declaration.findById(req.params.id);
    if (!rows[0]) return res.status(404).json({ error: 'Déclaration introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const changerStatut = async (req, res) => {
  const { statut } = req.body;
  const statuts = ['brouillon', 'soumis', 'approuve', 'rejete'];
  if (!statuts.includes(statut))
    return res.status(400).json({ error: `Statut invalide. Valeurs: ${statuts.join(', ')}` });

  try {
    const { rows } = await Declaration.updateStatut(req.params.id, statut);
    if (!rows[0]) return res.status(404).json({ error: 'Déclaration introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { creerDeclaration, listerDeclarations, getDeclaration, changerStatut };
