/**
 * CONTRÔLEUR DOUANE
 *
 * Gère les actions de l'inspecteur douanier sur les dossiers :
 *   1. Décision (Valider, Rejeter, Demander complément)
 *   2. Liquidation (calcul des taxes)
 *   3. Confirmation de paiement (via e-GUCE)
 *   4. Génération du Bon à Enlever (BAE)
 *
 * Chaque action est :
 *   - Journalisée dans actions_douane (piste d'audit)
 *   - Protégée par la machine à états (transitions valides uniquement)
 *   - Protégée par optimistic locking (version)
 */
const DossierDouane = require('../models/DossierDouane');
const ActionDouane = require('../models/ActionDouane');
const Taxe = require('../models/Taxe');
const { creerNotification, NOTIFICATION_TYPES } = require('../utils/notificationHelper');
const { withRetry, logError } = require('../utils/retryHelper');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Génère la référence BAE (Bon à Enlever).
 * Format : BAE-YYYYMMDD-XXXXX
 */
function genererReferenceBAE() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `BAE-${date}-${random}`;
}

/**
 * Calcule et met à jour les taxes d'un dossier via le modèle Taxe.
 * Appel externe simulé vers CAMCIS/e-GUCE avec mécanisme de retry.
 */
async function liquiderDossier(dossierId, declarationId, valeurMarchandise, tauxDroit, userId) {
  const liquidationFn = async (attempt) => {
    // Simule un appel à CAMCIS pour la liquidation
    if (attempt > 0) {
      // Sur les tentatives suivantes, on peut logger
      console.log(`[LIQUIDATION] Tentative ${attempt + 1} pour le dossier ${dossierId}`);
    }

    const taxeResult = await Taxe.calculer(dossierId, declarationId, valeurMarchandise, tauxDroit);
    return taxeResult.rows[0];
  };

  const result = await withRetry(liquidationFn, { maxRetries: 2, isRetryable: true });

  if (!result.success) {
    await logError('liquidation', result.error, { dossierId, declarationId });
    throw new Error(`Échec de la liquidation après ${result.attempts} tentatives: ${result.error.message}`);
  }

  // Journaliser la liquidation
  const db = require('../config/db');
  await ActionDouane.enregistrer(
    dossierId, userId, ActionDouane.TYPES_ACTION.LIQUIDER,
    `Liquidation effectuée. Total taxes: ${result.data.total_taxes}`,
    { total_taxes: result.data.total_taxes, tentative: result.attempts }
  );

  return result.data;
}

/**
 * Simule le paiement via e-GUCE avec retry.
 */
async function simulerPaiementEGUCE(taxeId, montant, dossierId, userId) {
  const paiementFn = async (attempt) => {
    if (attempt > 0) {
      console.log(`[PAIEMENT] Tentative ${attempt + 1} pour la taxe ${taxeId}`);
    }

    const paiementResult = await Taxe.simulerPaiementEguce(taxeId, montant);
    return paiementResult.rows[0];
  };

  const result = await withRetry(paiementFn, { maxRetries: 2, isRetryable: true });

  if (!result.success) {
    await logError('paiement_eguce', result.error, { taxeId, montant, dossierId });
    throw new Error(`Échec du paiement e-GUCE après ${result.attempts} tentatives: ${result.error.message}`);
  }

  await ActionDouane.enregistrer(
    dossierId, userId, ActionDouane.TYPES_ACTION.CONFIRMER_PAIEMENT,
    `Paiement confirmé via e-GUCE. Référence: ${result.data.reference_paiement}`,
    { reference_paiement: result.data.reference_paiement, montant }
  );

  return result.data;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/douane/dossiers/:id/action
 *
 * L'inspecteur douanier prend une décision sur un dossier :
 *   - VALIDER   → Le dossier passe en liquidation
 *   - REJETER   → Le dossier est rejeté (motif requis)
 *   - DEMANDER_COMPLEMENT → Pièces complémentaires demandées
 */
const actionSurDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, commentaire, motif_rejet } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ── 1. Vérifier le rôle ───────────────────────────────────────────────
    if (userRole !== 'douanier' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Seuls les douaniers peuvent effectuer cette action.'
      });
    }

    // ── 2. Valider les paramètres ─────────────────────────────────────────
    if (!action || !Object.values(DossierDouane.DECISIONS).includes(action)) {
      return res.status(400).json({
        error: 'Action invalide',
        details: `L'action doit être l'une des suivantes : ${Object.values(DossierDouane.DECISIONS).join(', ')}`,
        actions_possibles: {
          [DossierDouane.DECISIONS.VALIDE]: 'Valider le dossier et passer en liquidation',
          [DossierDouane.DECISIONS.REJETE]: 'Rejeter le dossier (motif requis)',
          [DossierDouane.DECISIONS.COMPLEMENT]: 'Demander des documents complémentaires',
        }
      });
    }

    if ((action === DossierDouane.DECISIONS.REJETE || action === DossierDouane.DECISIONS.COMPLEMENT) && !motif_rejet && !commentaire) {
      return res.status(400).json({
        error: 'Motif requis',
        details: 'Un motif ou commentaire est obligatoire pour un rejet ou une demande de complément.'
      });
    }

    // ── 3. Charger le dossier ─────────────────────────────────────────────
    const dossierResult = await DossierDouane.findById(id);
    if (dossierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const dossier = dossierResult.rows[0];

    // ── 4. Vérifier le statut actuel ──────────────────────────────────────
    if (dossier.statut !== DossierDouane.STATUTS.EN_ATTENTE_VALIDATION) {
      return res.status(400).json({
        error: 'Action non autorisée',
        details: `Le dossier est au statut "${dossier.statut}". Il doit être en attente de validation.`
      });
    }

    // ── 5. Appliquer la décision ──────────────────────────────────────────
    let nouveauStatut;
    let messageNotification;
    const extras = {
      decision_inspecteur: action,
      valide_par: userId,
      date_validation: new Date().toISOString(),
    };

    switch (action) {
      case DossierDouane.DECISIONS.VALIDE:
        nouveauStatut = DossierDouane.STATUTS.VALIDE;
        messageNotification = `Votre dossier ${dossier.reference} a été validé par la douane. Passage en liquidation.`;
        break;

      case DossierDouane.DECISIONS.REJETE:
        nouveauStatut = DossierDouane.STATUTS.REJETE;
        extras.motif_rejet = motif_rejet || commentaire;
        messageNotification = `Votre dossier ${dossier.reference} a été rejeté. Motif : ${extras.motif_rejet}`;
        break;

      case DossierDouane.DECISIONS.COMPLEMENT:
        nouveauStatut = DossierDouane.STATUTS.COMPLEMENT_ATTENDU;
        extras.commentaire_inspecteur = commentaire || motif_rejet;
        extras.motif_rejet = null;
        messageNotification = `Des documents complémentaires sont demandés pour le dossier ${dossier.reference}. Commentaire : ${extras.commentaire_inspecteur}`;
        break;
    }

    // ── 6. Exécuter la transition avec optimistic locking ────────────────
    const transitionResult = await DossierDouane.transitionStatut(
      dossier.id, nouveauStatut, dossier.version, extras
    );

    if (transitionResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Le dossier a été modifié entre-temps. Veuillez rafraîchir et réessayer.',
      });
    }

    const dossierMisAJour = transitionResult.rows[0];

    // ── 7. Journaliser l'action ──────────────────────────────────────────
    await ActionDouane.enregistrer(
      dossier.id, userId, action,
      commentaire || (motif_rejet ? `Motif : ${motif_rejet}` : `Dossier ${action}`),
      {
        ancien_statut: dossier.statut,
        nouveau_statut: nouveauStatut,
        action,
      }
    );

    // ── 8. Notifications ──────────────────────────────────────────────────
    try {
      await creerNotification(
        dossier.transitaire_id, dossier.declaration_id, NOTIFICATION_TYPES.STATUT_CHANGE,
        messageNotification,
        { dossier_id: dossier.id, statut: nouveauStatut, action }
      );
    } catch (notifErr) {
      console.error('[douaneController] Erreur notification:', notifErr.message);
    }

    // ── 9. Si validé : déclencher automatiquement la liquidation ──────────
    let liquidationResult = null;
    if (action === DossierDouane.DECISIONS.VALIDE) {
      try {
        const db = require('../config/db');
        const declResult = await (db.query || db)(
          'SELECT valeur FROM marchandises WHERE declaration_id = $1 LIMIT 1',
          [dossier.declaration_id]
        );
        const valeur = declResult.rows.length > 0 ? parseFloat(declResult.rows[0].valeur) : 1000000;

        liquidationResult = await liquiderDossier(
          dossier.id, dossier.declaration_id, valeur, 10, userId
        );

        // Transition vers EN_LIQUIDATION
        const dossierValide = (await DossierDouane.findById(dossier.id)).rows[0];
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.EN_LIQUIDATION, dossierValide.version
        );

        // Puis EN_ATTENTE_PAIEMENT automatiquement
        const dossierLiquide = (await DossierDouane.findById(dossier.id)).rows[0];
        await DossierDouane.transitionStatut(
          dossier.id, DossierDouane.STATUTS.EN_ATTENTE_PAIEMENT, dossierLiquide.version,
          { montant_taxes: liquidationResult.total_taxes }
        );

        // Notification au transitaire pour le paiement
        await creerNotification(
          dossier.transitaire_id, dossier.declaration_id, NOTIFICATION_TYPES.STATUT_CHANGE,
          `Taxes calculées pour le dossier ${dossier.reference} : ${liquidationResult.total_taxes} FCFA à payer via e-GUCE.`,
          { dossier_id: dossier.id, total_taxes: liquidationResult.total_taxes }
        );

      } catch (liqErr) {
        console.error('[douaneController] Erreur liquidation:', liqErr.message);
        await logError('liquidation_post_validation', liqErr, { dossier_id: dossier.id });
      }
    }

    // ── 10. Réponse ───────────────────────────────────────────────────────
    const dossierFinal = (await DossierDouane.findById(dossier.id)).rows[0];

    res.status(200).json({
      message: 'Action enregistrée avec succès.',
      action_effectuée: action,
      nouveau_statut: nouveauStatut,
      dossier: dossierFinal,
      liquidation: liquidationResult ? {
        taxes: liquidationResult,
        prochaine_etape: 'En attente de paiement par le transitaire via e-GUCE.',
      } : undefined,
    });

  } catch (error) {
    console.error('[douaneController] Erreur actionSurDossier:', error);
    await logError('actionSurDossier', error, {
      dossier_id: req.params.id,
      action: req.body?.action,
      user_id: req.user?.id,
    });

    res.status(500).json({
      error: 'Erreur lors du traitement de l\'action',
      details: error.message,
    });
  }
};

/**
 * POST /api/douane/dossiers/:id/payer
 *
 * Simule le paiement des taxes via e-GUCE par le transitaire.
 * Déclenche la génération du BAE après paiement confirmé.
 */
const payerDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ── 1. Charger le dossier ─────────────────────────────────────────────
    const dossierResult = await DossierDouane.findById(id);
    if (dossierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const dossier = dossierResult.rows[0];

    // ── 2. Vérifier les permissions ───────────────────────────────────────
    const isTransitaire = dossier.transitaire_id === userId;
    if (!isTransitaire && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Seul le transitaire assigné peut effectuer le paiement.'
      });
    }

    // ── 3. Vérifier le statut ─────────────────────────────────────────────
    if (dossier.statut !== DossierDouane.STATUTS.EN_ATTENTE_PAIEMENT) {
      return res.status(400).json({
        error: 'Action non autorisée',
        details: `Le dossier est au statut "${dossier.statut}". Il doit être en attente de paiement.`
      });
    }

    // ── 4. Récupérer la ligne de taxe ─────────────────────────────────────
    const taxeResult = await Taxe.findByDossier(dossier.id);
    if (taxeResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Taxes non calculées',
        details: 'Les taxes doivent être calculées avant le paiement.'
      });
    }

    const taxe = taxeResult.rows[0];

    if (taxe.statut_paiement === Taxe.STATUTS_PAIEMENT.PAYE) {
      return res.status(400).json({
        error: 'Déjà payé',
        details: 'Les taxes de ce dossier ont déjà été réglées.'
      });
    }

    // ── 5. Simuler le paiement via e-GUCE ────────────────────────────────
    const paiement = await simulerPaiementEGUCE(taxe.id, taxe.total_taxes, dossier.id, userId);

    // ── 6. Transition du dossier vers PAYE ────────────────────────────────
    const transitionResult = await DossierDouane.transitionStatut(
      dossier.id, DossierDouane.STATUTS.PAYE, dossier.version,
      {
        montant_taxes: taxe.total_taxes,
        reference_paiement: paiement.reference_paiement,
        date_paiement: new Date().toISOString(),
      }
    );

    if (transitionResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Le dossier a été modifié entre-temps. Veuillez rafraîchir et réessayer.',
      });
    }

    const dossierPaye = transitionResult.rows[0];

    // ── 7. Générer le BAE automatiquement ────────────────────────────────
    const baeReference = genererReferenceBAE();

    const baeResult = await DossierDouane.transitionStatut(
      dossier.id, DossierDouane.STATUTS.BAE_GENERE, dossierPaye.version,
      {
        bae_reference: baeReference,
        bae_url: `/api/documents/bae/${baeReference}`,
        date_bae: new Date().toISOString(),
        montant_taxes: taxe.total_taxes,
        reference_paiement: paiement.reference_paiement,
      }
    );

    if (baeResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Erreur lors de la génération du BAE. Veuillez réessayer.',
      });
    }

    // ── 8. Journaliser ─────────────────────────────────────────────────────
    await ActionDouane.enregistrer(
      dossier.id, userId, ActionDouane.TYPES_ACTION.GENERER_BAE,
      `BAE généré automatiquement après paiement. Référence: ${baeReference}`,
      { bae_reference: baeReference, reference_paiement: paiement.reference_paiement }
    );

    // ── 9. Notifications ──────────────────────────────────────────────────
    try {
      await creerNotification(
        dossier.transitaire_id, dossier.declaration_id, NOTIFICATION_TYPES.STATUT_CHANGE,
        `Paiement confirmé. Bon à Enlever (BAE) généré : ${baeReference}`,
        { dossier_id: dossier.id, bae_reference: baeReference }
      );

      // Notification au déclarant
      const Declaration = require('../models/Declaration');
      const declResult = await Declaration.findById(dossier.declaration_id);
      if (declResult.rows.length > 0 && declResult.rows[0].declarant_id) {
        await creerNotification(
          declResult.rows[0].declarant_id, dossier.declaration_id, NOTIFICATION_TYPES.STATUT_CHANGE,
          `BAE généré pour la déclaration ${declResult.rows[0].reference} : ${baeReference}`,
          { dossier_id: dossier.id, bae_reference: baeReference }
        );
      }
    } catch (notifErr) {
      console.error('[douaneController] Erreur notification BAE:', notifErr.message);
    }

    // ── 10. Réponse ───────────────────────────────────────────────────────
    const dossierFinal = (await DossierDouane.findById(dossier.id)).rows[0];

    res.status(200).json({
      message: 'Paiement effectué et BAE généré avec succès.',
      bae: {
        reference: baeReference,
        url: `/api/documents/bae/${baeReference}`,
        date_generation: new Date().toISOString(),
      },
      paiement: {
        reference: paiement.reference_paiement,
        transaction_id: paiement.transaction_id,
        montant: taxe.total_taxes,
      },
      dossier: dossierFinal,
    });

  } catch (error) {
    console.error('[douaneController] Erreur payerDossier:', error);
    await logError('payerDossier', error, {
      dossier_id: req.params.id,
      user_id: req.user?.id,
    });

    res.status(500).json({
      error: 'Erreur lors du paiement',
      details: error.message,
    });
  }
};

/**
 * GET /api/douane/dossiers
 * Tableau de bord : liste tous les dossiers pour les douaniers.
 */
const listerDossiersDouane = async (req, res) => {
  try {
    const { statut, circuit } = req.query;
    const result = await DossierDouane.findAll({ statut, circuit });

    res.status(200).json({
      count: result.rows.length,
      dossiers: result.rows,
    });
  } catch (error) {
    console.error('[douaneController] Erreur listerDossiersDouane:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des dossiers' });
  }
};

/**
 * GET /api/douane/dossiers/:id/historique
 * Récupère l'historique complet des actions sur un dossier.
 */
const historiqueDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const actionsResult = await ActionDouane.findByDossier(id);

    res.status(200).json({
      dossier_id: parseInt(id),
      actions: actionsResult.rows || [],
    });
  } catch (error) {
    console.error('[douaneController] Erreur historiqueDossier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
};

module.exports = {
  actionSurDossier,
  payerDossier,
  listerDossiersDouane,
  historiqueDossier,
};
