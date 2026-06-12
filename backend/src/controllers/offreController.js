const Offre = require('../models/Offre');
const Declaration = require('../models/Declaration');
const { creerNotification, NOTIFICATION_TYPES } = require('../utils/notificationHelper');

const soumettreOffre = async (req, res) => {
  try {
    const { declaration_id, montant_prestation, delai_estime_jours, message, mode_transport } = req.body;
    const transitaire_id = req.user.id;

    // Validation des champs obligatoires
    if (!declaration_id || !montant_prestation || !delai_estime_jours || !mode_transport) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants',
        details: 'declaration_id, montant_prestation et delai_estime_jours sont requis'
      });
    }

    // Validation des types de données
    if (isNaN(parseFloat(montant_prestation)) || isNaN(parseInt(delai_estime_jours))) {
      return res.status(400).json({
        error: 'Données invalides',
        details: 'montant_prestation doit être un nombre et delai_estime_jours doit être un entier'
      });
    }

    if (typeof mode_transport !== 'string' || !mode_transport.trim()) {
      return res.status(400).json({
        error: 'Mode de transport invalide',
        details: 'mode_transport doit être une chaîne non vide'
      });
    }

    // Vérifier que la déclaration existe et est disponible
    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Déclaration non trouvée',
        details: 'La déclaration spécifiée n\'existe pas'
      });
    }

    const declaration = declarationResult.rows[0];
    if (declaration.statut !== 'EN_ATTENTE_OFFRES') {
      return res.status(400).json({
        error: 'Déclaration non disponible',
        details: 'Cette déclaration n\'accepte plus d\'offres'
      });
    }

    // Vérifier qu'une offre n'existe pas déjà pour ce transitaire
    const existingOffreResult = await Offre.checkExistingOffre(declaration_id, transitaire_id);
    if (existingOffreResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Offre déjà soumise',
        details: 'Vous avez déjà soumis une offre pour cette déclaration'
      });
    }

    // Préparer les données de l'offre
    const offreData = {
      declaration_id: parseInt(declaration_id),
      transitaire_id,
      montant_prestation: parseFloat(montant_prestation),
      delai_estime_jours: parseInt(delai_estime_jours),
      message: message || null,
      mode_transport: mode_transport.trim()
    };

    // Créer l'offre
    const offreResult = await Offre.create(offreData);
    const nouvelleOffre = offreResult.rows[0];

    // Créer une notification pour le propriétaire de la déclaration
    try {
      await creerNotification(
        declaration.declarant_id,
        declaration_id,
        NOTIFICATION_TYPES.OFFRE_RECUE,
        `Nouvelle offre reçue de ${req.user.username} pour un montant de ${montant_prestation}€`,
        {
          offre_id: nouvelleOffre.id,
          transitaire_id: transitaire_id,
          transitaire_name: req.user.username,
          montant: montant_prestation,
          delai: delai_estime_jours
        }
      );
    } catch (notificationError) {
      console.error('Erreur lors de la création de notification:', notificationError);
      // Ne pas faire échouer la soumission d'offre si la notification échoue
    }

    res.status(201).json({
      message: 'Offre soumise avec succès',
      offre: nouvelleOffre,
      declaration_reference: declaration.reference
    });

  } catch (error) {
    console.error('Erreur lors de la soumission d\'offre:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la soumission d\'offre',
      details: error.message
    });
  }
};

const listerOffresParDossier = async (req, res) => {
  try {
    const { declaration_id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    // Validation du paramètre
    if (isNaN(parseInt(declaration_id))) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        details: 'declaration_id doit être un nombre entier'
      });
    }

    // Vérifier que la déclaration existe
    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Déclaration non trouvée',
        details: 'La déclaration spécifiée n\'existe pas'
      });
    }

    const declaration = declarationResult.rows[0];

    // Vérifier les permissions d'accès
    // Seul le propriétaire de la déclaration ou un admin/douanier peut voir les offres
    if (user_role !== 'admin' && user_role !== 'douanier' && declaration.declarant_id !== user_id) {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Vous n\'êtes pas autorisé à voir les offres pour cette déclaration'
      });
    }

    // Récupérer les offres pour cette déclaration
    const offresResult = await Offre.findByDeclaration(declaration_id);
    const offres = offresResult.rows;

    res.status(200).json({
      message: 'Offres récupérées avec succès',
      declaration: {
        id: declaration.id,
        reference: declaration.reference,
        port_depart: declaration.port_depart,
        port_arrivee: declaration.port_arrivee,
        date_embarquement: declaration.date_embarquement,
        statut: declaration.statut
      },
      count: offres.length,
      offres: offres
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des offres:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des offres',
      details: error.message
    });
  }
};

const listerMesOffres = async (req, res) => {
  try {
    const transitaire_id = req.user.id;

    // Récupérer toutes les offres du transitaire connecté
    const offresResult = await Offre.findByTransitaire(transitaire_id);
    const offres = offresResult.rows;

    res.status(200).json({
      message: 'Vos offres récupérées avec succès',
      count: offres.length,
      offres: offres
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des offres du transitaire:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de vos offres',
      details: error.message
    });
  }
};

module.exports = {
  soumettreOffre,
  listerOffresParDossier,
  listerMesOffres
};