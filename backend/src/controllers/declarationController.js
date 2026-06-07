// CORRECTION : Imports directs des modèles spécifiques
const Declaration = require('../models/Declaration');
const Marchandise = require('../models/Marchandise');

/**
 * Crée une nouvelle déclaration et ses marchandises associées.
 */
const creerDeclaration = async (req, res) => {
  const reference = `DEC-${Date.now()}`;
  const declarant_id = req.user.id;

  try {
    const description = req.body.description;
    const typeMarchandise = req.body.typeMarchandise || req.body.type_marchandise;
    const poids = req.body.poids || req.body.poids_marchandise;
    const valeur = req.body.valeur || req.body.valeur_marchandise;

    console.log("📥 [FRONTEND DATA] Champs reçus :", { description, typeMarchandise, poids, valeur });

    // 1. Création de la déclaration
    console.log("⏳ [SQL START] Insertion dans 'declarations'...");
    const resDeclaration = await Declaration.create(reference, declarant_id);
    
    if (!resDeclaration || !resDeclaration.rows[0]) {
      throw new Error("Échec lors de la création de la déclaration.");
    }
    
    const declaration_id = resDeclaration.rows[0].id;

    // 2. Calcul des taxes
    const tauxTaxes = 0.10; 
    const total_taxes = valeur ? parseFloat(valeur) * tauxTaxes : 0.00;

    // 3. Insertion de la marchandise
    try {
      if (Marchandise && typeof Marchandise.create === 'function') {
        await Marchandise.create(declaration_id, description, typeMarchandise, poids, valeur, total_taxes);
        console.log("✅ [SQL SUCCESS] Marchandise insérée.");
      }
    } catch (err) {
      // CORRECTION : 'err' est ici la variable utilisée pour capturer l'erreur
      console.error("❌ [SQL CRASH - TABLE MARCHANDISES] :", err.message);
    }

    // 4. Mise à jour du montant global
    await Declaration.accumulerMontant(declaration_id, total_taxes);

    // 5. Réponse finale
    const resFinale = await Declaration.findById(declaration_id);
    res.status(201).json(resFinale.rows[0]);

  } catch (err) {
    console.error("❌ [GLOBAL CRASH - CREER DECLARATION] :", err);
    res.status(500).json({ error: err.message });
  }
};

const listerDeclarations = async (req, res) => {
  try {
    const { id, role } = req.user;
    let result;

    if (role === 'douanier' || role === 'admin') {
      result = await Declaration.findAll();
    } else {
      result = await Declaration.findByDeclarant(id);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDeclaration = async (req, res) => {
  try {
    const result = await Declaration.findById(req.params.id);
    if (!result.rows[0]) return res.status(404).json({ error: 'Déclaration introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const changerStatut = async (req, res) => {
  const { statut } = req.body;
  try {
    const result = await Declaration.updateStatut(req.params.id, statut);
    if (!result.rows[0]) return res.status(404).json({ error: 'Déclaration introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { creerDeclaration, listerDeclarations, getDeclaration, changerStatut };