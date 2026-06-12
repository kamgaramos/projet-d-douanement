const Declaration = require('../models/Declaration');
const Marchandise = require('../models/Marchandise');

const creerDeclaration = async (req, res) => {
  try {
    const { description, typeMarchandise, poids, valeur } = req.body;
    const declarant_id = req.user.id;

    // Générer une référence unique
    const reference = `DEC-${Date.now()}-${declarant_id}`;

    // MODIFICATION : On envoie un objet pour garantir que la référence est bien incluse
    // Assure-toi que ton modèle Declaration.create accepte cet objet
    const declarationData = {
      reference,
      declarant_id,
      statut: 'brouillon'
    };

    const declarationResult = await Declaration.create(declarationData);
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

    console.log(`LISTER DECLARATIONS: user=${id} role=${role}`);

    if (role === 'douanier' || role === 'admin') {
      result = await Declaration.findAll();
    } else if (role === 'transitaire') {
      result = await Declaration.findAllAvailable();
    } else {
      result = await Declaration.findByDeclarant(id);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const accepterDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: transitaire_id, role } = req.user;

    if (role !== 'transitaire') {
      return res.status(403).json({ error: 'Accès refusé : rôle transitaire requis' });
    }

    const result = await Declaration.updateStatut(id, 'EN_COURS', transitaire_id);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    res.json({
      message: 'Déclaration acceptée avec succès',
      declaration: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de l’acceptation de la déclaration :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const accepterOffre = async (req, res) => {
  try {
    const { id } = req.params;
    const { transitaire_id } = req.body;
    const { id: user_id, role } = req.user;

    // Vérifier que c'est le déclarant qui accepte l'offre
    if (role !== 'declarant') {
      return res.status(403).json({ error: 'Accès refusé : seul le déclarant peut accepter une offre' });
    }

    // Vérifier que la déclaration existe et appartient au déclarant
    const declarationResult = await Declaration.findById(id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    const declaration = declarationResult.rows[0];
    if (declaration.declarant_id !== user_id) {
      return res.status(403).json({ error: 'Accès refusé : cette déclaration ne vous appartient pas' });
    }

    // Vérifier que le statut est EN_ATTENTE_OFFRES
    if (declaration.statut !== 'EN_ATTENTE_OFFRES') {
      return res.status(400).json({ error: 'Cette déclaration n\'est pas en attente d\'offres' });
    }

    // Mettre à jour le statut à EN_COURS_DE_TRANSPORT et enregistrer le transitaire
    const result = await Declaration.updateStatut(id, 'EN_COURS_DE_TRANSPORT', transitaire_id);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Erreur lors de la mise à jour' });
    }

    res.json({
      message: 'Offre acceptée avec succès. Transport en cours.',
      declaration: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de l\'acceptation de l\'offre :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const supprimerDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: user_id, role } = req.user;

    // Vérifier que c'est le déclarant ou un admin
    const declarationResult = await Declaration.findById(id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    const declaration = declarationResult.rows[0];
    if (declaration.declarant_id !== user_id && role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé : vous ne pouvez supprimer que vos propres déclarations' });
    }

    // Vérifier que c'est en brouillon
    if (declaration.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Seules les déclarations en brouillon peuvent être supprimées' });
    }

    // Supprimer les marchandises associées
    await Declaration.deleteMarchandises(id);

    // Supprimer la déclaration
    await Declaration.delete(id);

    res.json({ message: 'Déclaration supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
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

const publierDeclaration = async (req, res) => {
  try {
    const { description, typeMarchandise, poids, valeur, port_depart, port_arrivee, date_embarquement } = req.body;
    const declarant_id = req.user.id;

    if (!port_depart || !port_arrivee || !date_embarquement) {
      return res.status(400).json({ 
        error: 'Champs obligatoires manquants', 
        details: 'port_depart, port_arrivee et date_embarquement sont requis'
      });
    }

    const reference = `MKT-${Date.now()}-${declarant_id}`;

    const declarationData = {
      reference,
      declarant_id,
      port_depart,
      port_arrivee,
      date_embarquement,
      statut: 'EN_ATTENTE_OFFRES'
    };

    const declarationResult = await Declaration.create(declarationData);
    const declaration = declarationResult.rows[0];

    if (description && typeMarchandise && poids && valeur) {
      await Marchandise.create(
        declaration.id,
        description,
        typeMarchandise,
        parseFloat(poids),
        parseFloat(valeur)
      );
    }

    res.status(201).json({
      message: 'Déclaration publiée avec succès',
      declaration
    });
  } catch (error) {
    console.error('Erreur lors de la publication:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

const listerMarketplace = async (req, res) => {
  try {
    const result = await Declaration.findAllAvailable();
    res.status(200).json({ declarations: result.rows });
  } catch (error) {
    console.error('Erreur Marketplace:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

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