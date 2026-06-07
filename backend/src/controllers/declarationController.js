const Declaration = require('../models/Declaration');
const Marchandise = require('../models/Marchandise');

const creerDeclaration = async (req, res) => {
  try {
    const { description, typeMarchandise, poids, valeur } = req.body;
    const declarant_id = req.user.id;

    // Générer une référence unique
    const reference = `DEC-${Date.now()}-${declarant_id}`;

    // Créer la déclaration
    const declarationResult = await Declaration.create(reference, declarant_id);
    const declaration = declarationResult.rows[0];

    // Créer la marchandise associée
    await Marchandise.create(
      declaration.id,
      description,
      typeMarchandise,
      parseFloat(poids),
      parseFloat(valeur)
    );

    res.status(201).json({
      message: 'Déclaration créée avec succès',
      declaration
    });
  } catch (error) {
    console.error('Erreur lors de la création:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const listerDeclarations = async (req, res) => {
  try {
    const { id, role } = req.user;
    let result;

    // Si l'utilisateur est douanier ou admin, il voit tout. Sinon, seulement ses déclarations.
    if (role === 'douanier' || role === 'admin') {
      result = await Declaration.findAll(); // Assure-toi que cette méthode existe dans ton modèle
    } else {
      result = await Declaration.findByDeclarant(id);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Declaration.findById(id);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const changerStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const result = await Declaration.updateStatut(id, statut);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    res.json({
      message: 'Statut mis à jour avec succès',
      declaration: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  creerDeclaration,
  listerDeclarations,
  getDeclaration,
  changerStatut
};