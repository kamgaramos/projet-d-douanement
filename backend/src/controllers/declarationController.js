const db = require('../config/db');
const Declaration = require('../models/Declaration');
const Marchandise = require('../models/Marchandise');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Fonction utilitaire pour calculer les taxes
const calculerTaxes = async (valeur, code_sh) => {
  try {
    const query = 'SELECT taux_droit_douane FROM nomenclature_douaniere WHERE code_sh = $1';
    const result = await db.query(query, [code_sh]);
    
    if (result.rows.length === 0) return 0;
    
    const taux = parseFloat(result.rows[0].taux_droit_douane);
    return valeur * (taux / 100);
  } catch (err) {
    console.error("Erreur calcul taxes:", err);
    return 0;
  }
};

const publierDeclaration = async (req, res) => {
  try {
    const { description, typeMarchandise, poids, valeur, port_depart, port_arrivee, date_embarquement, code_sh } = req.body;
    const declarant_id = req.user.id;

    if (!port_depart || !port_arrivee || !date_embarquement || !code_sh) {
      return res.status(400).json({ error: 'Champs obligatoires manquants, dont le code_sh' });
    }

    // Calcul automatique
    const montantDroits = await calculerTaxes(parseFloat(valeur), code_sh);

    const reference = `MKT-${Date.now()}-${declarant_id}`;

    const declarationData = {
      reference,
      declarant_id,
      port_depart,
      port_arrivee,
      date_embarquement,
      statut: 'EN_ATTENTE_OFFRES',
      montant_droits_douane: montantDroits // Enregistrement du résultat calculé
    };

    const declarationResult = await Declaration.create(declarationData);
    const declaration = declarationResult.rows[0];

    if (description && typeMarchandise && poids && valeur) {
      // Assure-toi que Marchandise.create accepte ce 6ème argument
      await Marchandise.create(
        declaration.id,
        description,
        typeMarchandise,
        parseFloat(poids),
        parseFloat(valeur),
        code_sh
      );
    }

    res.status(201).json({ message: 'Déclaration publiée avec succès', declaration });
  } catch (error) {
    console.error('Erreur lors de la publication:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ... (Garde le reste de tes fonctions existantes telles quelles)
module.exports = {
  creerDeclaration,
  listerDeclarations,
  getDeclaration,
  changerStatut,
  accepterDeclaration,
  accepterOffre,
  supprimerDeclaration,
  publierDeclaration,
  listerMarketplace
};