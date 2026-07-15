const db = require('../config/db');
const Declaration = require('../models/Declaration');
const ActionDouane = require('../models/ActionDouane');
const Taxe = require('../models/Taxe');
const Nomenclature = require('../models/Nomenclature');
const { withRetry, logError } = require('./retryHelper');

async function liquiderDossier(dossierId, declarationId, userId) {
  const marchandisesResult = await db.query(
    'SELECT valeur, code_sh FROM marchandises WHERE declaration_id = $1',
    [declarationId]
  );

  const marchandises = marchandisesResult.rows;
  if (marchandises.length === 0) {
    throw new Error('Aucune marchandise trouvée pour cette déclaration. Impossible de liquider.');
  }

  let totalValeur = 0;
  let totalDroits = 0;
  const tarifsUtilises = [];

  for (const item of marchandises) {
    const valeur = Number.parseFloat(item.valeur || 0);
    const tauxDroit = await Nomenclature.getTauxDroit(item.code_sh);
    const droits = valeur * (tauxDroit / 100);

    totalValeur += valeur;
    totalDroits += droits;
    tarifsUtilises.push({ code_sh: item.code_sh, taux: tauxDroit, droits: Number(droits.toFixed(2)) });
  }

  const tauxDroitMoyen = totalValeur > 0
    ? Number.parseFloat(((totalDroits / totalValeur) * 100).toFixed(2))
    : 10;

  console.log(`[LIQUIDATION] Déclaration ${declarationId} : valeur totale = ${totalValeur}, taux moyen = ${tauxDroitMoyen}%`);
  console.log('[LIQUIDATION] Tarifs utilisés', tarifsUtilises);

  const liquidationFn = async (attempt) => {
    if (attempt > 0) {
      console.log(`[LIQUIDATION] Tentative ${attempt + 1} pour le dossier ${dossierId}`);
    }

    const taxeResult = await Taxe.calculer(dossierId, declarationId, totalValeur, tauxDroitMoyen);
    return taxeResult.rows[0];
  };

  const result = await withRetry(liquidationFn, { maxRetries: 2, isRetryable: true });

  if (!result.success) {
    await logError('liquidation', result.error, { dossierId, declarationId });
    throw new Error(`Échec de la liquidation après ${result.attempts} tentatives: ${result.error.message}`);
  }

  const taxeCalculee = result.data;

  try {
    await Declaration.updateMontantDroits(declarationId, taxeCalculee.total_taxes);
    console.log(`✓ Droits mise à jour dans déclaration #${declarationId}: ${taxeCalculee.total_taxes}`);
  } catch (updateErr) {
    console.error('Erreur mise à jour droits déclaration:', updateErr.message);
  }

  await ActionDouane.enregistrer(
    dossierId, userId, ActionDouane.TYPES_ACTION.LIQUIDER,
    `Liquidation effectuée. Total taxes: ${taxeCalculee.total_taxes} FCFA`,
    {
      total_taxes: taxeCalculee.total_taxes,
      droits_douane: taxeCalculee.droits_douane,
      tva: taxeCalculee.tva_montant,
      tentative: result.attempts
    }
  );

  return taxeCalculee;
}

async function estimerDroitsDouane(declarationId) {
  const marchandisesResult = await db.query(
    'SELECT valeur, code_sh FROM marchandises WHERE declaration_id = $1',
    [declarationId]
  );

  const marchandises = marchandisesResult.rows;
  if (marchandises.length === 0) {
    console.log(`[ESTIMATION] Aucune marchandise trouvée pour la déclaration #${declarationId}`);
    return 0;
  }

  let totalValeur = 0;
  let totalDroits = 0;
  let totalTva = 0;

  for (const item of marchandises) {
    const valeur = Number.parseFloat(item.valeur || 0);
    const tauxDroit = await Nomenclature.getTauxDroit(item.code_sh);
    const droits = valeur * (tauxDroit / 100);
    const tva = (valeur + droits) * 0.1925; // TVA standard de 19.25%

    totalValeur += valeur;
    totalDroits += droits;
    totalTva += tva;
  }

  // Ajout des frais forfaitaires (CSS: 50000 FCFA + Magasinage: 25000 FCFA)
  // pour s'aligner avec le calcul officiel de la liquidation
  const totalTaxes = totalDroits + totalTva + 50000 + 25000;
  const totalArrondi = Number.parseFloat(totalTaxes.toFixed(2));

  console.log(`[ESTIMATION] Déclaration ${declarationId} : valeur totale = ${totalValeur}, taxes estimées = ${totalArrondi}`);

  try {
    await Declaration.updateMontantDroits(declarationId, totalArrondi);
    console.log(`[ESTIMATION] ✓ Droits mis à jour dans déclaration #${declarationId}: ${totalArrondi}`);
  } catch (updateErr) {
    console.error('[ESTIMATION] Erreur lors de la mise à jour des droits de la déclaration:', updateErr.message);
  }

  return totalArrondi;
}

module.exports = {
  liquiderDossier,
  estimerDroitsDouane,
};
