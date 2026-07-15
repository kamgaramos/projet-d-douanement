const db = require('../config/db');
const Declaration = require('../models/Declaration');
const Marchandise = require('../models/Marchandise');
const { estimerDroitsDouane } = require('../utils/liquidationHelper');

// --- Lister toutes les déclarations (enrichies avec les offres) ---
const listerDeclarations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const result = await db.query(`SELECT d.*,
      m.description, m.type_marchandise, m.poids, m.valeur, m.code_sh
    FROM declarations d
    LEFT JOIN marchandises m ON m.declaration_id = d.id
    ORDER BY d.id DESC`);
    const declarations = result.rows;

    // Enrichir chaque déclaration avec les infos d'offres
    const enriched = await Promise.all(declarations.map(async (dec) => {
      // Compter les offres PENDING (offres actives en attente)
      const offresPendingResult = await db.query(`
        SELECT o.id, o.transitaire_id, u.username
        FROM offres o
        LEFT JOIN users u ON o.transitaire_id = u.id
        WHERE o.declaration_id = $1 AND o.statut = 'PENDING'
        ORDER BY o.created_at DESC
      `, [dec.id]);

      const offreCount = offresPendingResult.rows.length;
      const transitairesOffreurs = offresPendingResult.rows.map(r => r.username).filter(Boolean);

      // Pour le transitaire connecté : récupérer SON offre (quel que soit son statut)
      let monOffreId = null;
      let monOffreDetails = null;
      if (userRole === 'transitaire') {
        const monOffreResult = await db.query(`
          SELECT id, mode_transport, montant_prestation, delai_estime_jours, message, statut, created_at
          FROM offres
          WHERE declaration_id = $1 AND transitaire_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [dec.id, userId]);

        if (monOffreResult.rows.length > 0) {
          monOffreId = monOffreResult.rows[0].id;
          monOffreDetails = monOffreResult.rows[0];
        }
      }

      return {
        ...dec,
        offre_count: offreCount,
        mon_offre_id: monOffreId,
        mon_offre: monOffreDetails,
        transitaires_offreurs: transitairesOffreurs
      };
    }));

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Erreur listerDeclarations :", error);
    res.status(500).json({ error: 'Erreur lors de la récupération', details: error.message });
  }
};

// --- Créer une nouvelle déclaration (CORRIGÉE) ---
const creerDeclaration = async (req, res) => {
  try {
    const { description, code_sh, typeMarchandise, poids, valeur } = req.body;
    
    // Vérification de sécurité pour l'utilisateur
    if (!req.user || !req.user.id) {
        console.error("Erreur : req.user est absent");
        return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    const declarant_id = req.user.id;
    console.log("Tentative de création par l'utilisateur ID :", declarant_id);

    // 1. Création de la déclaration
    const newDec = await Declaration.create({ declarant_id, statut: 'brouillon' });
    
    // Extraction sécurisée de l'ID de la déclaration créée
    const declaration = (newDec && newDec.rows) ? newDec.rows[0] : newDec;
    
    if (!declaration || !declaration.id) {
        throw new Error("Impossible de récupérer l'ID de la déclaration après création.");
    }

    // 2. Création de la marchandise associée
    await Marchandise.create(declaration.id, description, typeMarchandise, poids, valeur, 0, code_sh);

    // 3. Estimer les droits de douane initiaux (GUCE)
    await estimerDroitsDouane(declaration.id);

    const finalDecResult = await db.query('SELECT * FROM declarations WHERE id = $1', [declaration.id]);
    res.status(201).json(finalDecResult.rows[0]);
  } catch (error) {
    // Log précis pour voir pourquoi l'enregistrement échoue
    console.error("ERREUR DÉTAILLÉE DANS CREER_DECLARATION :", error);
    res.status(500).json({ error: 'Erreur lors de la création', details: error.message });
  }
};

// --- Autres fonctions basiques ---
const getDeclaration = async (req, res) => {
  try {
    const result = await Declaration.findById(req.params.id);
    res.status(200).json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

const supprimerDeclaration = async (req, res) => {
  try {
    const declResult = await Declaration.findById(req.params.id);
    if (declResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }
    const decl = declResult.rows[0];
    if (decl.declarant_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé', details: 'Vous n\'êtes pas le propriétaire de cette déclaration' });
    }
    await db.query('DELETE FROM declarations WHERE id = $1', [req.params.id]);
    res.status(200).json({ message: 'Supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};

const publierDeclaration = async (req, res) => {
  try {
    const { description, typeMarchandise, poids, valeur, port_depart, port_arrivee, date_embarquement, code_sh } = req.body;
    const declarant_id = req.user.id;

    if (!port_depart || !port_arrivee || !date_embarquement || !code_sh) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const reference = `MKT-${Date.now()}-${declarant_id}`;
    const declarationData = { reference, declarant_id, port_depart, port_arrivee, date_embarquement, statut: 'EN_ATTENTE_OFFRES', montant_droits_douane: 0 };

    const declarationResult = await Declaration.create(declarationData);
    const declaration = declarationResult.rows[0];

    if (description) {
      await Marchandise.create(declaration.id, description, typeMarchandise, parseFloat(poids), parseFloat(valeur), 0, code_sh);
      // Estimer les droits de douane initiaux (GUCE)
      await estimerDroitsDouane(declaration.id);
    }
    const finalDecResult = await db.query('SELECT * FROM declarations WHERE id = $1', [declaration.id]);
    res.status(201).json({ message: 'Déclaration publiée', declaration: finalDecResult.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

const changerStatut = async (req, res) => {
  try {
    // statut attendu par frontend: req.body.statut
    const { statut } = req.body;
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Vérifier que l'utilisateur est propriétaire ou admin
    const declResult = await Declaration.findById(id);
    if (declResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }
    const decl = declResult.rows[0];
    if (decl.declarant_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé', details: 'Vous n\'êtes pas le propriétaire de cette déclaration' });
    }

    // On force la valeur souhaitée par ton besoin (soumettre -> EN_ATTENTE_OFFRES)
    // si aucune valeur n'est fournie.
    const statutFinal = statut || 'EN_ATTENTE_OFFRES';

    // updateStatut gère aussi transitaire_id si nécessaire.
    const result = await Declaration.updateStatut(id, statutFinal, null);

    // Certains drivers renvoient rows; d'autres non.
    const updated = result?.rows?.[0] || result;

    return res.status(200).json({ message: 'Statut mis à jour', declaration: updated });
  } catch (error) {
    console.error('Erreur changerStatut:', error);
    return res.status(500).json({ error: 'Erreur serveur lors du changement de statut', details: error.message });
  }
};
const listerMarketplace = (req, res) => res.status(200).json({ message: "À implémenter" });

module.exports = {
  creerDeclaration, listerDeclarations, getDeclaration, changerStatut,
  supprimerDeclaration, publierDeclaration, listerMarketplace
};