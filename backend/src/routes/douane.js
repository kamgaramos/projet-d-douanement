/**
 * ROUTES DOUANE (Inspecteurs)
 *
 * Endpoints réservés aux douaniers pour :
 *   - Prendre une décision (Valider/Rejeter/Complément)
 *   - Consulter les dossiers
 *   - Voir l'historique des actions
 * Endpoints pour le transitaire :
 *   - Payer les taxes via e-GUCE
 */

const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Taxe = require('../models/Taxe');
const {
  actionSurDossier,
  payerDossier,
  listerDossiersDouane,
  historiqueDossier,
} = require('../controllers/douaneController');

router.use(authMiddleware);

// ─── Actions douanières ─────────────────────────────────────────────────────

// POST /api/douane/dossiers/:id/action — Décision de l'inspecteur
router.post('/dossiers/:id/action', actionSurDossier);

// GET /api/douane/dossiers — Tableau de bord de la douane (filtres: ?statut=&circuit=)
router.get('/dossiers', listerDossiersDouane);

// GET /api/douane/dossiers/:id/historique — Piste d'audit complète
router.get('/dossiers/:id/historique', historiqueDossier);

// POST /api/douane/dossiers/:id/payer — Paiement des taxes (transitaire)
router.post('/dossiers/:id/payer', payerDossier);

// GET /api/douane/dossiers/:id/taxes — Détail des taxes d'un dossier
router.get('/dossiers/:id/taxes', async (req, res) => {
  try {
    const { id } = req.params;
    const taxeResult = await Taxe.findByDossier(id);
    if (taxeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Taxes non trouvées pour ce dossier' });
    }
    res.status(200).json({ taxe: taxeResult.rows[0] });
  } catch (error) {
    console.error('[douane] Erreur taxes:', error);
    res.status(500).json({ error: 'Erreur récupération taxes' });
  }
});

// GET /api/douane/paiements/historique — Historique des paiements du transitaire
router.get('/paiements/historique', async (req, res) => {
  const DossierDouane = require('../models/DossierDouane');
  try {
    const userId = req.user.id;
    const dossiersResult = await DossierDouane.findByTransitaire(userId);
    const dossiers = dossiersResult.rows.filter(d => d.montant_taxes > 0 || d.reference_paiement);

    const paiementsDetail = await Promise.all(dossiers.map(async (d) => {
      const taxeResult = await Taxe.findByDossier(d.id);
      return {
        dossier_id: d.id,
        dossier_reference: d.reference,
        declaration_reference: d.declaration_reference,
        taxe: taxeResult.rows[0] || null,
        statut: d.statut,
        montant_taxes: d.montant_taxes,
        reference_paiement: d.reference_paiement,
        date_paiement: d.date_paiement,
        bae_reference: d.bae_reference,
      };
    }));
    res.status(200).json({ count: paiementsDetail.length, paiements: paiementsDetail });
  } catch (error) {
    console.error('[douane] Erreur historique paiements:', error);
    res.status(500).json({ error: 'Erreur récupération historique' });
  }
});

module.exports = router;
