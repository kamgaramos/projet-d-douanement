/**
 * CONTRÔLEUR DOSSIER DOUANE
 *
 * Gère le cycle de vie du dossier depuis la soumission des documents
 * jusqu'à l'affectation du circuit de dédouanement.
 *
 * Workflow :
 *   1. Le transitaire soumet les documents du dossier
 *   2. Le système applique l'analyse de risque (circuit aléatoire)
 *   3. Selon le circuit :
 *      - VERT  → validation automatique → liquidation
 *      - JAUNE → file d'attente douane (contrôle documentaire)
 *      - ROUGE → file d'attente douane (contrôle physique)
 */
const DossierDouane = require('../models/DossierDouane');
const ActionDouane = require('../models/ActionDouane');
const Taxe = require('../models/Taxe');
const Declaration = require('../models/Declaration');
const Document = require('../models/Document');
const Offre = require('../models/Offre');
const { creerNotification, NOTIFICATION_TYPES } = require('../utils/notificationHelper');
const { withRetry, logError } = require('../utils/retryHelper');

// ─── Types de documents requis pour la soumission ───────────────────────────

const TYPES_DOCUMENTS_REQUIS = [
  'FACTURE_COMMERCIALE',
  'PACKING_LIST',
  'CONNAISSEMENT',
  'CERTIFICAT_ORIGINE',
  'DECLARATION_EN_DOUANE',
];

// ─── Probabilités des circuits (pour simulation d'analyse de risque) ────────

const CIRCUIT_PROBABILITIES = {
  [DossierDouane.CIRCUITS.VERT]:  0.40,  // 40%
  [DossierDouane.CIRCUITS.JAUNE]: 0.35,  // 35%
  [DossierDouane.CIRCUITS.ROUGE]: 0.25,  // 25%
};

/**
 * Sélectionne un circuit aléatoire basé sur les probabilités définies.
 * @returns {string} VERT | JAUNE | ROUGE
 */
function choisirCircuit() {
  const rand = Math.random();
  let cumulative = 0;

  for (const [circuit, probability] of Object.entries(CIRCUIT_PROBABILITIES)) {
    cumulative += probability;
    if (rand <= cumulative) return circuit;
  }

  return DossierDouane.CIRCUITS.VERT; // fallback
}

/**
 * Génère la référence BAE (Bon à Enlever).
 * Format : BAE-YYYYMMDD-XXXXX
 */
function genererReferenceBAE() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `BAE-${date}-${random}`;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/dossiers/:id/soumettre
 *
 * Le transitaire soumet les documents de son dossier de dédouanement.
 * Après soumission :
 *   1. Vérification que les documents requis sont présents
 *   2. Transition SOUMIS
 *   3. Analyse de risque → affectation du circuit (VERT/JAUNE/ROUGE)
 *   4. Selon le circuit, transition automatique vers le statut suivant
 */
const soumettreDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ── 1. Charger le dossier ────────────────────────────────────────────
    const dossierResult = await DossierDouane.findById(id);
    if (dossierResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Dossier non trouvé',
        details: 'Ce dossier de dédouanement n\'existe pas.'
      });
    }

    const dossier = dossierResult.rows[0];

    // ── 2. Vérifier les permissions ───────────────────────────────────────
    if (dossier.transitaire_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Seul le transitaire assigné à ce dossier peut soumettre les documents.'
      });
    }

    // ── 3. Vérifier le statut actuel ──────────────────────────────────────
    if (dossier.statut !== DossierDouane.STATUTS.DOCUMENTS_ATTENDUS &&
        dossier.statut !== DossierDouane.STATUTS.COMPLEMENT_ATTENDU) {
      return res.status(400).json({
        error: 'Action non autorisée',
        details: `Le dossier est au statut "${dossier.statut}". Vous ne pouvez soumettre que depuis DOCUMENTS_ATTENDUS ou COMPLEMENT_ATTENDU.`
      });
    }

    // ── 4. Vérifier que les documents requis sont présents ────────────────
    const documentsResult = await Document.findByDeclaration(dossier.declaration_id);
    const documentsExistants = documentsResult.rows || [];

    // Vérifier le type de documents soumis
    const typesSoumis = documentsExistants.map(doc => doc.type_document);
    const documentsManquants = TYPES_DOCUMENTS_REQUIS.filter(
      type => !typesSoumis.includes(type)
    );

    if (documentsManquants.length > 0) {
      return res.status(400).json({
        error: 'Documents incomplets',
        details: 'Tous les documents requis doivent être soumis avant validation.',
        documents_requis: TYPES_DOCUMENTS_REQUIS,
        documents_manquants: documentsManquants,
        documents_soumis: typesSoumis,
      });
    }

    // ── 5. Transition vers SOUMIS ─────────────────────────────────────────
    const transitionResult = await DossierDouane.transitionStatut(
      dossier.id,
      DossierDouane.STATUTS.SOUMIS,
      dossier.version,
      { circuit: null, decision_inspecteur: DossierDouane.DECISIONS.EN_ATTENTE }
    );

    if (transitionResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Le dossier a été modifié par un autre utilisateur. Veuillez rafraîchir et réessayer.',
      });
    }

    const dossierSoumis = transitionResult.rows[0];

    // ── 6. Analyse de risque → affectation du circuit ────────────────────
    const circuit = choisirCircuit();

    // Journaliser l'affectation du circuit
    await ActionDouane.enregistrer(
      dossier.id, userId, ActionDouane.TYPES_ACTION.AFFECTER_CIRCUIT,
      `Circuit ${circuit} assigné automatiquement par analyse de risque.`,
      { circuit, probabilite: CIRCUIT_PROBABILITIES[circuit] }
    );

    // ── 7. Transition selon le circuit ────────────────────────────────────
    let statutApresCircuit;
    let messageNotification;

    switch (circuit) {
      case DossierDouane.CIRCUITS.VERT:
        // Circuit VERT → validation automatique → liquidation
        statutApresCircuit = DossierDouane.STATUTS.CIRCUIT_VERT;
        messageNotification = `Circuit VERT assigné : validation automatique en cours pour le dossier ${dossier.reference}.`;

        // Transition VERT → VALIDE → LIQUIDATION (chaîne automatique)
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.CIRCUIT_VERT, dossierSoumis.version + 1,
          { circuit }
        );

        // Récupérer la version mise à jour
        const dossierVert = (await DossierDouane.findById(dossier.id)).rows[0];

        // VALIDE
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.VALIDE, dossierVert.version,
          { circuit, valide_par: null, date_validation: new Date().toISOString() }
        );

        // EN_LIQUIDATION automatique
        const dossierValide = (await DossierDouane.findById(dossier.id)).rows[0];
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.EN_LIQUIDATION, dossierValide.version,
          { circuit }
        );

        break;

      case DossierDouane.CIRCUITS.JAUNE:
        statutApresCircuit = DossierDouane.STATUTS.CIRCUIT_JAUNE;
        messageNotification = `Circuit JAUNE assigné : contrôle documentaire requis pour le dossier ${dossier.reference}.`;

        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.CIRCUIT_JAUNE, dossierSoumis.version + 1,
          { circuit }
        );

        // EN_ATTENTE_VALIDATION (pour le douanier)
        const dossierJaune = (await DossierDouane.findById(dossier.id)).rows[0];
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.EN_ATTENTE_VALIDATION, dossierJaune.version,
          { circuit }
        );

        break;

      case DossierDouane.CIRCUITS.ROUGE:
        statutApresCircuit = DossierDouane.STATUTS.CIRCUIT_ROUGE;
        messageNotification = `Circuit ROUGE assigné : contrôle physique requis pour le dossier ${dossier.reference}.`;

        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.CIRCUIT_ROUGE, dossierSoumis.version + 1,
          { circuit }
        );

        // EN_ATTENTE_VALIDATION (pour le douanier)
        const dossierRouge = (await DossierDouane.findById(dossier.id)).rows[0];
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.EN_ATTENTE_VALIDATION, dossierRouge.version,
          { circuit }
        );

        break;
    }

    // ── 8. Notifications ──────────────────────────────────────────────────
    try {
      // Notification au transitaire
      await creerNotification(
        dossier.transitaire_id, dossier.declaration_id, NOTIFICATION_TYPES.STATUT_CHANGE,
        messageNotification,
        { dossier_id: dossier.id, circuit, statut: statutApresCircuit }
      );

      // Notification aux douaniers
      const db = require('../config/db');
      const douaniersResult = await (db.query || db)(
        "SELECT id FROM users WHERE role = 'douanier'"
      );
      const douaniers = douaniersResult.rows.map(r => r.id);

      await Promise.all(
        douaniers.map(douanierId =>
          creerNotification(
            douanierId, dossier.declaration_id, 'STATUT_CHANGE',
            `Nouveau dossier ${dossier.reference} en attente (circuit ${circuit})`,
            { dossier_id: dossier.id, circuit }
          )
        )
      );
    } catch (notifErr) {
      console.error('[dossierController] Erreur notification:', notifErr.message);
    }

    // ── 9. Retourner le résultat ──────────────────────────────────────────
    const dossierFinal = await DossierDouane.findById(dossier.id);

    res.status(200).json({
      message: 'Dossier soumis avec succès.',
      circuit_assigné: circuit,
      statut: statutApresCircuit,
      dossier: dossierFinal.rows[0],
      prochaine_etape: circuit === DossierDouane.CIRCUITS.VERT
        ? 'En attente de liquidation et paiement.'
        : 'En attente de validation par la douane.',
    });

  } catch (error) {
    console.error('[dossierController] Erreur soumettreDeclaration:', error);

    // Journaliser dans la dead letter queue
    await logError(
      'soumettreDeclaration',
      error,
      { dossier_id: req.params.id, user_id: req.user?.id }
    );

    res.status(500).json({
      error: 'Erreur lors de la soumission du dossier',
      details: error.message,
    });
  }
};

/**
 * GET /api/dossiers/:id
 * Récupère les détails d'un dossier avec son historique d'actions.
 */
const getDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const dossierResult = await DossierDouane.findById(id);
    if (dossierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const dossier = dossierResult.rows[0];

    // Vérifier les droits d'accès
    const declarationResult = await Declaration.findById(dossier.declaration_id);
    const declaration = declarationResult.rows[0];

    const isTransitaire = dossier.transitaire_id === userId;
    const isDeclarant = declaration && declaration.declarant_id === userId;
    const isDouanier = userRole === 'douanier' || userRole === 'admin';

    if (!isTransitaire && !isDeclarant && !isDouanier) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Récupérer historique des actions
    const actionsResult = await ActionDouane.findByDossier(id);

    // Récupérer les documents associés
    const documentsResult = await Document.findByDeclaration(dossier.declaration_id);

    res.status(200).json({
      dossier,
      actions: actionsResult.rows || [],
      documents: documentsResult.rows || [],
    });

  } catch (error) {
    console.error('[dossierController] Erreur getDossier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du dossier', details: error.message });
  }
};

/**
 * GET /api/dossiers/mes-dossiers
 * Liste les dossiers du transitaire connecté.
 */
const mesDossiers = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await DossierDouane.findByTransitaire(userId);

    res.status(200).json({
      count: result.rows.length,
      dossiers: result.rows,
    });
  } catch (error) {
    console.error('[dossierController] Erreur mesDossiers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos dossiers' });
  }
};

/**
 * GET /api/dossiers/en-attente
 * Liste les dossiers en attente de validation douanière.
 */
const dossiersEnAttente = async (req, res) => {
  try {
    const result = await DossierDouane.findEnAttenteDouane();

    res.status(200).json({
      count: result.rows.length,
      dossiers: result.rows,
    });
  } catch (error) {
    console.error('[dossierController] Erreur dossiersEnAttente:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des dossiers en attente' });
  }
};

// ─── Export ─────────────────────────────────────────────────────────────────

module.exports = {
  soumettreDeclaration,
  getDossier,
  mesDossiers,
  dossiersEnAttente,
};
