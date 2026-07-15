/**
 * CONTRÔLEUR OFFRE
 *
 * Gère le cycle de vie des offres des transitaires avec :
 * - Optimistic locking pour éviter les doubles acceptations
 * - Machine à états (PENDING → ACCEPTED | REJECTED | EXPIRED)
 * - Création automatique du dossier de dédouanement après acceptation
 */
const Offre = require('../models/Offre');
const Declaration = require('../models/Declaration');
const DossierDouane = require('../models/DossierDouane');
const { creerNotification, NOTIFICATION_TYPES } = require('../utils/notificationHelper');
const { logError } = require('../utils/retryHelper');
const { estimerDroitsDouane } = require('../utils/liquidationHelper');

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/offres/soumettre
 * Soumettre une nouvelle offre (existant, inchangé)
 */
const soumettreOffre = async (req, res) => {
  try {
    const { declaration_id, montant_prestation, delai_estime_jours, message, mode_transport } = req.body;
    const transitaire_id = req.user.id;

    if (!declaration_id || !montant_prestation || !delai_estime_jours || !mode_transport) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants',
        details: 'declaration_id, montant_prestation, delai_estime_jours et mode_transport sont requis'
      });
    }

    if (isNaN(parseFloat(montant_prestation)) || isNaN(parseInt(delai_estime_jours))) {
      return res.status(400).json({
        error: 'Données invalides',
        details: 'montant_prestation doit être un nombre et delai_estime_jours doit être un entier'
      });
    }

    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    const declaration = declarationResult.rows[0];
    const statutNormalise = String(declaration.statut ?? '').trim().toUpperCase().replace(/\s+/g, '_');

    if (statutNormalise !== 'EN_ATTENTE_OFFRES') {
      return res.status(400).json({
        error: 'Déclaration non disponible',
        details: 'Cette déclaration n\'accepte plus d\'offres'
      });
    }

    const existingOffreResult = await Offre.checkExistingOffre(declaration_id, transitaire_id);
    if (existingOffreResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Offre déjà soumise',
        details: 'Vous avez déjà soumis une offre pour cette déclaration'
      });
    }

    const offreData = {
      declaration_id: parseInt(declaration_id),
      transitaire_id,
      montant_prestation: parseFloat(montant_prestation),
      delai_estime_jours: parseInt(delai_estime_jours),
      message: message || null,
      mode_transport: mode_transport.trim()
    };

    const offreResult = await Offre.create(offreData);
    const nouvelleOffre = offreResult.rows[0];

    try {
      await creerNotification(
        declaration.declarant_id, declaration_id, NOTIFICATION_TYPES.OFFRE_RECUE,
        `Nouvelle offre reçue de ${req.user.username} pour un montant de ${montant_prestation}€`,
        { offre_id: nouvelleOffre.id, transitaire_id, montant: montant_prestation, delai: delai_estime_jours }
      );
    } catch (notificationError) {
      console.error('Erreur notification:', notificationError);
    }

    res.status(201).json({
      message: 'Offre soumise avec succès',
      offre: nouvelleOffre,
      declaration_reference: declaration.reference
    });

  } catch (error) {
    console.error('Erreur soumission offre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/offres/:id/accepter
 *
 * Accepte une offre avec GARANTIE D'INTÉGRITÉ :
 *   1. Vérifie que l'offre est en statut PENDING (machine à états)
 *   2. Utilise l'optimistic locking (version) pour la concurrence
 *   3. Si échec (rowCount === 0) → conflit (409), un concurrent a gagné
 *   4. En cas de succès → crée le dossier de dédouanement
 */
const accepterOffre = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ── 1. Charger l'offre ────────────────────────────────────────────────
    const offreResult = await Offre.findById(id);
    if (offreResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Offre non trouvée',
        details: 'Aucune offre trouvée avec cet identifiant.'
      });
    }

    const offre = offreResult.rows[0];

    // ── 2. Vérifier que l'offre est en PENDING (machine à états) ──────────
    if (!Offre.transitionAutorisee(offre.statut, Offre.STATUTS.ACCEPTED)) {
      return res.status(400).json({
        error: 'Transition non autorisée',
        details: `L'offre est au statut "${offre.statut}". Seules les offres en statut PENDING peuvent être acceptées.`,
        statut_actuel: offre.statut,
        statuts_possibles: Object.values(Offre.STATUTS),
      });
    }

    // ── 3. Vérifier les permissions ───────────────────────────────────────
    // Seul le propriétaire de la déclaration ou un admin peut accepter
    const declarationResult = await Declaration.findById(offre.declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration associée introuvable.' });
    }

    const declaration = declarationResult.rows[0];
    if (declaration.declarant_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Accès refusé',
        details: 'Seul le déclarant propriétaire de la déclaration peut accepter une offre.'
      });
    }

    // ── 4. Vérifier la déclaration toujours en attente d'offres ────────────
    const statutDec = String(declaration.statut ?? '').trim().toUpperCase().replace(/\s+/g, '_');
    if (statutDec !== 'EN_ATTENTE_OFFRES') {
      return res.status(400).json({
        error: 'Déclaration déjà attribuée',
        details: 'Cette déclaration n\'est plus en attente d\'offres.'
      });
    }

    // ── 5. OPTIMISTIC LOCKING : mise à jour conditionnelle ────────────────
    const transitionResult = await Offre.transitionStatut(
      offre.id,
      Offre.STATUTS.ACCEPTED,
      offre.version,
      { accepted_at: new Date().toISOString() }
    );

    // Si aucune ligne affectée → conflit (concurrent plus rapide)
    if (transitionResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Cette offre a été modifiée entre-temps (version obsolète). Veuillez rafraîchir et réessayer.',
        code: 'OPTIMISTIC_LOCK_CONFLICT',
        conseil: 'Rechargez la page pour obtenir la version la plus récente.',
      });
    }

    const offreAcceptee = transitionResult.rows[0];

    // ── 6. REJETER AUTOMATIQUEMENT les autres offres PENDING ──────────────
    try {
      const autresOffres = await Offre.findByDeclaration(offre.declaration_id);
      const offresARejeter = (autresOffres.rows || []).filter(
        o => o.id !== offre.id && o.statut === Offre.STATUTS.PENDING
      );

      await Promise.all(offresARejeter.map(o =>
        Offre.transitionStatut(o.id, Offre.STATUTS.REJECTED, o.version, {
          rejection_reason: 'Une autre offre a été acceptée pour cette déclaration.',
        }).catch(err => console.error(`[offreController] Erreur rejet offre ${o.id}:`, err.message))
      ));
    } catch (rejectionErr) {
      console.error('[offreController] Erreur rejet automatique:', rejectionErr.message);
      // Non bloquant : l'offre principale est déjà acceptée
    }

    // ── 7. CRÉER LE DOSSIER DE DÉDOUANEMENT ───────────────────────────────
    let dossierDouane = null;
    try {
      const dossierResult = await DossierDouane.create({
        offre_id: offre.id,
        declaration_id: offre.declaration_id,
        transitaire_id: offre.transitaire_id,
      });

      dossierDouane = dossierResult.rows[0];
      console.log(`[offreController] ✓ Dossier douane créé : ${dossierDouane.reference}`);

    } catch (dossierErr) {
      // Si la création du dossier échoue, on doit rollback l'offre
      // Comme on est en SQL direct, on ré-accepte le statut précédent
      console.error('[offreController] CRITIQUE : Échec création dossier, rollback offre:', dossierErr.message);
      await logError('creation_dossier_douane', dossierErr, {
        offre_id: offre.id,
        declaration_id: offre.declaration_id,
      });

      // Rollback : remettre l'offre en PENDING
      try {
        await Offre.transitionStatut(offre.id, Offre.STATUTS.PENDING, offreAcceptee.version, {
          accepted_at: null,
        });
      } catch (rollbackErr) {
        console.error('[offreController] CRITIQUE : Rollback échoué aussi !', rollbackErr.message);
      }

      return res.status(500).json({
        error: 'Erreur lors de la création du dossier de dédouanement',
        details: 'L\'offre a été remise dans son état précédent. Veuillez réessayer.',
      });
    }

    // ── 8. METTRE À JOUR LE STATUT DE LA DÉCLARATION ─────────────────────
    try {
      await Declaration.updateStatut(
        offre.declaration_id,
        'DOSSIER_OUVERT',
        offre.transitaire_id
      );
      // Estimer et mettre à jour les droits de douane de la déclaration (GUCE)
      await estimerDroitsDouane(offre.declaration_id);
    } catch (declErr) {
      console.error('[offreController] Erreur mise à jour statut/droits déclaration:', declErr.message);
      // Non bloquant
    }

    // ── 9. NOTIFICATIONS ───────────────────────────────────────────────────
    try {
      // Au transitaire gagnant
      await creerNotification(
        offre.transitaire_id, offre.declaration_id, NOTIFICATION_TYPES.OFFRE_ACCEPTEE,
        `Votre offre pour la déclaration ${declaration.reference} a été acceptée. Dossier douane créé : ${dossierDouane.reference}`,
        { offre_id: offre.id, dossier_id: dossierDouane.id, dossier_reference: dossierDouane.reference }
      );

      // Aux transitaires rejetés (si possible - la boucle forEach est silencieuse)
    } catch (notifErr) {
      console.error('[offreController] Erreur notification acceptation:', notifErr.message);
    }

    // ── 10. RÉPONSE ──────────────────────────────────────────────────────
    res.status(200).json({
      message: 'Offre acceptée avec succès.',
      offre: offreAcceptee,
      dossier_douane: dossierDouane,
      prochaine_etape: 'Le transitaire doit soumettre les documents de dédouanement.',
    });

  } catch (error) {
    console.error('[offreController] Erreur accepterOffre:', error);
    await logError('accepterOffre', error, { offre_id: req.params.id, user_id: req.user?.id });

    res.status(500).json({
      error: 'Erreur lors de l\'acceptation de l\'offre',
      details: error.message,
    });
  }
};

/**
 * POST /api/offres/:id/rejeter
 * Rejeter une offre (déclarant ou admin)
 */
const rejeterOffre = async (req, res) => {
  try {
    const { id } = req.params;
    const { raison } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const offreResult = await Offre.findById(id);
    if (offreResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offre non trouvée' });
    }

    const offre = offreResult.rows[0];

    if (!Offre.transitionAutorisee(offre.statut, Offre.STATUTS.REJECTED)) {
      return res.status(400).json({
        error: 'Transition non autorisée',
        details: `L'offre est au statut "${offre.statut}". Seules les offres PENDING peuvent être rejetées.`
      });
    }

    const declResult = await Declaration.findById(offre.declaration_id);
    if (declResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration introuvable' });
    }
    const declaration = declResult.rows[0];

    if (declaration.declarant_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const transitionResult = await Offre.transitionStatut(
      offre.id, Offre.STATUTS.REJECTED, offre.version,
      { rejected_by: userId, rejection_reason: raison || null }
    );

    if (transitionResult.rows.length === 0) {
      return res.status(409).json({
        error: 'Conflit de concurrence',
        details: 'Cette offre a été modifiée entre-temps.',
      });
    }

    try {
      await creerNotification(
        offre.transitaire_id, offre.declaration_id, NOTIFICATION_TYPES.OFFRE_REJETEE,
        `Votre offre pour la déclaration ${declaration.reference} a été rejetée${raison ? ` : ${raison}` : ''}`,
        { offre_id: offre.id, raison }
      );
    } catch (notifErr) {
      console.error('[offreController] Erreur notification rejet:', notifErr.message);
    }

    res.status(200).json({
      message: 'Offre rejetée.',
      offre: transitionResult.rows[0],
    });

  } catch (error) {
    console.error('[offreController] Erreur rejeterOffre:', error);
    res.status(500).json({ error: 'Erreur lors du rejet', details: error.message });
  }
};

/**
 * GET /api/offres/dossier/:declaration_id
 * Lister les offres d'une déclaration (existant)
 */
const listerOffresParDossier = async (req, res) => {
  try {
    const { declaration_id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (isNaN(parseInt(declaration_id))) {
      return res.status(400).json({ error: 'declaration_id doit être un entier' });
    }

    const declarationResult = await Declaration.findById(declaration_id);
    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Déclaration non trouvée' });
    }

    const declaration = declarationResult.rows[0];

    if (user_role !== 'admin' && user_role !== 'douanier' && declaration.declarant_id !== user_id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const offresResult = await Offre.findByDeclaration(declaration_id);
    const offres = offresResult.rows;

    res.status(200).json({
      message: 'Offres récupérées',
      declaration: { id: declaration.id, reference: declaration.reference, statut: declaration.statut },
      count: offres.length,
      offres
    });

  } catch (error) {
    console.error('Erreur liste offres:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * GET /api/offres/mes-offres
 * Lister les offres du transitaire connecté (existant)
 */
const listerMesOffres = async (req, res) => {
  try {
    const transitaire_id = req.user.id;
    const offresResult = await Offre.findByTransitaire(transitaire_id);

    res.status(200).json({
      message: 'Vos offres récupérées',
      count: offresResult.rows.length,
      offres: offresResult.rows
    });

  } catch (error) {
    console.error('Erreur liste offres transitaire:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

module.exports = {
  soumettreOffre,
  accepterOffre,
  rejeterOffre,
  listerOffresParDossier,
  listerMesOffres
};
