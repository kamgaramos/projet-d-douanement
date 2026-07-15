# 📋 SYSTÈME DE DROITS DE DOUANE - Documentation Complète

## 🎯 Vue d'Ensemble

Les droits de douane s'appliquent en **3 étapes** du cycle de vie d'une déclaration:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CYCLE DE VIE COMPLET                             │
└─────────────────────────────────────────────────────────────────────┘

1️⃣ DÉCLARATION CRÉÉE
   └─ Montant: 0.00 (pas encore de droits)
   └ Statut: "brouillon" ou "EN_ATTENTE_OFFRES"

2️⃣ OFFRE ACCEPTÉE (Création du dossier douane)
   └─ Déclenche le CALCUL DES DROITS
   └─ Statut dossier: "DOCUMENTS_ATTENDUS" → "EN_LIQUIDATION"
   
3️⃣ LIQUIDATION PAR LA DOUANE
   └─ Calcule les taxes exactes
   └─ Crée un record dans la table 'taxes'
   └─ Montant_taxes mis à jour dans dossiers_douane
   
4️⃣ PAIEMENT DES TAXES (e-GUCE)
   └─ Statut: "EN_ATTENTE_PAIEMENT" → "PAYE"
   
5️⃣ DÉDOUANEMENT APPROUVÉ
   └─ Génération du BAE (Bon à Enlever)
   └─ Statut: "BAE_GENERE"
```

---

## 💰 FORMULE DE CALCUL DES DROITS

### Base de Calcul
```
Valeur Déclarée (USD) = montant déclaré par le déclarant

Exemple: 25,000 $
```

### Étape 1: Droits de Douane
```
Taux Droit = Tarif selon Code SH (ex: 10%, 15%, 20%)
Code SH = Système Harmonisé (ex: 8517.12 pour électronique)

DROITS = Valeur Déclarée × (Taux / 100)

Exemple:
  25,000 × (10 / 100) = 2,500 $
```

### Étape 2: TVA (19.25% standard)
```
BASE TVA = Valeur Déclarée + Droits Douane

TVA = (Valeur Déclarée + Droits) × 0.1925

Exemple:
  (25,000 + 2,500) × 0.1925 = 5,256.25 $
```

### Étape 3: Frais Accessoires
```
CSS (Contribution Spéciale)     = 50,000 FCFA (fixe)
Frais Magasinage               = 25,000 FCFA (fixe)
```

### Total à Payer
```
TOTAL = Droits + TVA + Frais CSS + Frais Magasinage

Exemple (en supposant conversion 1 USD = 600 FCFA):
  = 2,500 $ + 5,256.25 $ + 50,000 FCFA + 25,000 FCFA
  = 2,500 + 5,256.25 + 83.33 + 41.67
  = 7,881.25 $  (environ)
```

---

## 🏗️ ARCHITECTURE ACTUELLEMENT EN PLACE

### 1. Table `declarations`
```sql
- id
- reference
- declarant_id
- montant_droits_douane   ← CHAMP POUR AFFICHER
- statut ('brouillon', 'EN_ATTENTE_OFFRES', 'DOSSIER_OUVERT', etc.)
```

### 2. Table `dossiers_douane`
```sql
- id
- offre_id
- declaration_id
- transitaire_id
- statut (DOCUMENTS_ATTENDUS → EN_LIQUIDATION → EN_ATTENTE_PAIEMENT → PAYE → BAE_GENERE)
- montant_taxes           ← MONTANT CALCULÉ PENDANT LIQUIDATION
- circuit (VERT/JAUNE/ROUGE)
```

### 3. Table `taxes`
```sql
- id
- dossier_id
- declaration_id
- valeur_marchandise      (assiette)
- taux_droit              (de 1% à 30% selon code SH)
- droits_douane           (calculé)
- tva_taux                (19.25%)
- tva_montant             (calculé)
- frais_accessoires       (50,000 FCFA)
- frais_magasinage        (25,000 FCFA)
- total_taxes             (somme de tout)
- statut_paiement         (IMPAYE → PAYE)
```

---

## ⚙️ FLUX D'APPLICATION DES DROITS

### Moment 1: Affichage dans les listes
```
Frontend affiche: montant_droits_douane
Source: declarations.montant_droits_douane

❌ ACTUELLEMENT: Toujours 0.00
✅ À CORRIGER: Mettre à jour pendant la liquidation
```

### Moment 2: Lors de l'acceptation d'une offre
```
offreController.accepterOffre()
  → Crée un dossierDouane (statut: DOCUMENTS_ATTENDUS)
  → Déclenche ULTÉRIEUREMENT la liquidation
```

### Moment 3: Liquidation (qui calcule les droits)
```
douaneController.actionSurDossier()
  → Transition vers EN_LIQUIDATION
  → Appel à Taxe.calculer()
  → Insère dans table taxes
  → Met à jour dossiers_douane.montant_taxes
  ❌ NE MET PAS À JOUR declarations.montant_droits_douane
```

---

## 🔧 CORRECTIONS NÉCESSAIRES

### Fix #1: Mettre à jour `declarations.montant_droits_douane`
Après la liquidation, copier `total_taxes` vers `declarations.montant_droits_douane`

```sql
UPDATE declarations 
SET montant_droits_douane = (
  SELECT total_taxes FROM taxes 
  WHERE declaration_id = declarations.id 
  ORDER BY created_at DESC LIMIT 1
)
WHERE id = $1;
```

### Fix #2: S'assurer que le code SH est utilisé
Le taux de droit dépend du Code SH (nomenclature tarifaire).

```javascript
// Lookup table basique
const TARIFS_PAR_CODE_SH = {
  '8517.12': 10,    // Électronique
  '6204': 15,       // Vêtements
  '0901': 5,        // Café
  '1234': 20,       // Exemple
};
```

### Fix #3: Corriger l'affichage au frontend
- Dans `declaration-details`: afficher `montant_droits_douane`
- Dans `douanier-dashboard`: afficher dans la table
- Dans le transitaire: montrer les taxes dues

---

## 🗺️ FICHIERS À CORRIGER

### Backend
- [ ] `controllers/douaneController.js` - Mettre à jour declarations après liquidation
- [ ] `models/Taxe.js` - Assurer le calcul correct
- [ ] Ajouter table de lookup: `nomenclature_tarifare.js`

### Frontend
- [ ] `dashboard.component.ts` - Charger les taxes
- [ ] `douanier-dashboard.component.ts` - Afficher dans le tableau
- [ ] `declaration-details.component.ts` - Afficher les droits calculés

---

## 📊 TABLEAU RÉSUMÉ

| Étape | Qui | Action | Champ Mis à Jour |
|-------|-----|--------|------------------|
| 1 | Déclarant | Crée une déclaration | declarations.id, reference |
| 2 | Transitaire | Soumet une offre | offres.montant_prestation |
| 3 | Déclarant | Accepte l'offre | dossiers_douane créé, declarations.statut = "DOSSIER_OUVERT" |
| 4 | Douanier | Analyse documents | dossiers_douane.circuit = VERT/JAUNE/ROUGE |
| 5 | Douanier | Valide/Liquide | taxes créé, **dossiers_douane.montant_taxes**, **declarations.montant_droits_douane** |
| 6 | Transitaire | Paie taxes | taxes.statut_paiement = PAYE |
| 7 | Douanier | Génère BAE | dossiers_douane.bae_reference, bae_url |

---

## 🎬 EXEMPLE COMPLET AVEC CHIFFRES RÉELS

```
Déclaration #1782177160822
├─ Marchandise: Voiture électrique
├─ Valeur déclarée: 25,000 $ USD
├─ Code SH: 8517.12 (électronique)
├─ Taux tarif: 10%
│
└─ CALCUL DES DROITS:
   ├─ Droits de douane: 25,000 × 10% = 2,500 $
   ├─ TVA: (25,000 + 2,500) × 19.25% = 5,256.25 $
   ├─ Frais CSS: 50,000 FCFA ≈ 83.33 $
   ├─ Frais Magasinage: 25,000 FCFA ≈ 41.67 $
   │
   └─ TOTAL À PAYER: 7,881.25 $ (environ)
        ou 4,728,750 FCFA
```

---

## ✅ RÉSUMÉ POUR L'APPLICATION

1. **Les droits DOIVENT s'afficher** dans le tableau des déclarations
2. **Ils se calculent** lors de la liquidation (action douanier)
3. **Ils dépendent du Code SH** (nomenclature tarifaire)
4. **Ils incluent TVA + Frais** (pas juste droits)
5. **Ils doivent être payés** avant BAE
