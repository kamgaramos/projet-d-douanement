const { Marchandise, Declaration } = require('../models');

/**
 * Calcule les taxes douanières selon les règles métier :
 *  - Droit de Douane (DD) = valeur_caf * 20%
 *  - TVA               = (valeur_caf + DD) * 19.25%
 *  - Total Taxes       = DD + TVA
 */
const calculerTaxes = (valeur_caf) => {
  const caf = parseFloat(valeur_caf);
  const droit_douane = parseFloat((caf * 0.20).toFixed(2));
  const tva = parseFloat(((caf + droit_douane) * 0.1925).toFixed(2));
  const total_taxes = parseFloat((droit_douane + tva).toFixed(2));
  return { droit_douane, tva, total_taxes };
};

/**
 * POST /api/declarations/:declaration_id/marchandises
 * Ajoute une marchandise, calcule ses taxes et met à jour le montant de la déclaration.
 */
const ajouterMarchandise = async (req, res) => {
  const { declaration_id } = req.params;
  const { description, code_sh, valeur_caf, poids_net } = req.body;

  // Validation des champs obligatoires
  if (!description || !code_sh || !valeur_caf || !poids_net)
    return res.status(400).json({ error: 'Champs requis : description, code_sh, valeur_caf, poids_net' });

  if (isNaN(parseFloat(valeur_caf)) || parseFloat(valeur_caf) <= 0)
    return res.status(400).json({ error: 'valeur_caf doit être un nombre positif' });

  try {
    // Calcul automatique des taxes
    const { droit_douane, tva, total_taxes } = calculerTaxes(valeur_caf);

    // Insertion de la marchandise avec ses taxes
    const { rows } = await Marchandise.create(
      declaration_id, description, code_sh,
      valeur_caf, poids_net,
      droit_douane, tva, total_taxes
    );
    const marchandise = rows[0];

    // Accumulation du total_taxes sur montant_droits_douane de la déclaration
    const { rows: decRows } = await Declaration.accumulerMontant(declaration_id, total_taxes);

    // Réponse claire avec détail des calculs
    res.status(201).json({
      marchandise,
      taxes_calculees: {
        droit_douane,
        tva,
        total_taxes,
      },
      declaration: {
        id: declaration_id,
        montant_droits_douane_total: decRows[0].montant_droits_douane,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/declarations/:declaration_id/marchandises
 * Liste toutes les marchandises d'une déclaration.
 */
const listerMarchandises = async (req, res) => {
  try {
    const { rows } = await Marchandise.findByDeclaration(req.params.declaration_id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/declarations/marchandises/:id
 * Supprime une marchandise par son id.
 */
const supprimerMarchandise = async (req, res) => {
  try {
    await Marchandise.deleteById(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { ajouterMarchandise, listerMarchandises, supprimerMarchandise };
