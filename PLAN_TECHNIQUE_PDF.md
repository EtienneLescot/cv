# Plan Technique - Génération PDF Pixel-Perfect

## 🎯 Objectif
Générer un PDF multi-pages avec un rendu identique au navigateur, sans @media print, avec pagination intelligente.

## 📐 Approche Visuelle - Fenêtre Virtuelle A4

### Concept de la Fenêtre Virtuelle
```
┌─────────────────────┐  ← Viewport = Fenêtre A4 (794×1123px @ 96 DPI)
│                     │
│   CONTENU PAGE 1    │  ← Tout ce qui est visible = Page 1
│                     │
│                     │
└─────────────────────┘
        ↓ Scroll de exactement 1123px
┌─────────────────────┐
│                     │
│   CONTENU PAGE 2    │  ← Après scroll = Page 2
│                     │
│                     │
└─────────────────────┘
```

### Ratio A4
- **Largeur** : 210mm = 794px @ 96 DPI
- **Hauteur** : 297mm = 1123px @ 96 DPI
- **Ratio** : 1:1.414 (√2)

## 🛠️ Architecture Technique

### Phase 1 : Capture (Actuelle)
**Outil** : Playwright `page.screenshot({ fullPage: true })`
- ✅ Gère automatiquement le scroll
- ✅ Capture pixel-perfect
- ✅ Respecte media='screen'

**Viewport** : 794×1123px (ratio A4 exact)
- Container CSS s'adapte automatiquement
- Pas besoin de redimensionnement

### Phase 2 : Découpage Intelligent

#### Étape 2.1 : Découpage de Base
```javascript
const pageHeight = 1123; // Hauteur A4 en pixels
const numPages = Math.ceil(totalHeight / pageHeight);

// Découpage simple
for (let i = 0; i < numPages; i++) {
  const startY = i * pageHeight;
  const endY = Math.min(startY + pageHeight, totalHeight);
  // Extraire slice[startY → endY]
}
```

#### Étape 2.2 : Ajustement aux Sections
```javascript
// Trouver le point de coupure idéal proche de (i * pageHeight)
const idealCutY = i * pageHeight;
const safeCuts = findSectionsNear(idealCutY, tolerance = ±50px);

// Choisir le cut point qui minimise la coupure de contenu
const actualCutY = chooseBestCut(safeCuts, idealCutY);
```

#### Étape 2.3 : Gestion des Marges Entre Pages
```
Page 1 end     : Y = 1069px
                 ← 40px de marge (fond de page 1)
Cut point      : Y = 1109px (milieu de l'espace)
                 ← 40px de marge (haut de page 2)
Page 2 start   : Y = 1149px
```

### Phase 3 : Composition PDF

#### Approche Actuelle (Simple)
```javascript
// Chaque slice = exactement 794×1123px
// → Embed directement dans page PDF A4
page.drawImage(slice, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
```

## 📋 Checklist Technique

### ✅ Ce qui fonctionne
- [x] Capture fullPage avec Playwright
- [x] Détection des sections (findSafeCutPoints)
- [x] Media='screen' forcé
- [x] Fonts synchronisées

### ⚠️ Ce qui doit être corrigé
- [ ] **Viewport** : Passer à 794×1123px (ratio A4)
- [ ] **Découpage** : Tranches de exactement 1123px
- [ ] **Redimensionnement** : Proportionnel au viewport
- [ ] **Marges** : Cut au milieu de l'espace inter-sections
- [ ] **Fond** : Détecter couleur du thème pour remplissage

### 🔧 Modifications à Apporter

#### 1. CONFIG - Viewport A4
```javascript
viewport: {
  width: 794,   // A4 width @ 96 DPI
  height: 1123  // A4 height @ 96 DPI
}
```

#### 2. Capture - FullPage Screenshot
```javascript
await page.screenshot({
  path: screenshotPath,
  fullPage: true,  // Playwright gère le scroll
  type: 'png'
});
```

#### 3. Découpage - Slicing Exact
```javascript
const pageHeightPx = 1123;
const scaleRatio = 794 / screenshotWidth;
const scaledPageHeight = Math.round(pageHeightPx * scaleRatio);

// Découper tous les scaledPageHeight px
// avec ajustement ±50px aux sections
```

#### 4. CSS - Pagination Visuelle
```css
html.pdf-mode {
  /* Repères visuels pour debugging */
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 1123px,
    red 1123px,
    red 1125px  /* Ligne rouge tous les 1123px */
  );
}

/* Forcer le saut de page avec marge équilibrée */
.projects-highlight {
  margin-top: 40px;  /* Espace avant section */
  padding-top: 40px; /* Espace dans section */
}
```

## 🚀 Phase 2 (Future) - HD Multi-Tile

### Concept
Au lieu de capturer chaque page d'un coup, découper en tuiles :
```
┌─────┬─────┐
│ T1  │ T2  │  ← Page 1 = 4 tuiles HD (zoom 2x)
├─────┼─────┤
│ T3  │ T4  │
└─────┴─────┘
```

### Avantages
- 🎯 Qualité 2x-4x supérieure
- 🎯 Texte ultra-net
- 🎯 Rendu professionnel

### Complexité
- Gestion des tuiles overlapping
- Stitching précis
- Temps de génération ×4

## 📊 Métriques de Qualité

### Objectifs
- ✅ Texte lisible à 11-12pt minimum
- ✅ Pas de blanc inutile entre sections
- ✅ Marges équilibrées haut/bas de page
- ✅ 2 pages maximum pour le CV
- ✅ Génération < 10 secondes

### Tests
```bash
# Test génération
node generateCvPdf.js --locale fr --theme dark

# Vérifier
# - Nombre de pages : 2
# - Taille fichier : < 500KB
# - Résolution texte : nette
# - Pas de blanc
```

## 🔍 Debugging

### Outils
1. **Screenshot debug** : Sauvegarder chaque slice avant PDF
2. **Repères visuels** : Lignes rouges CSS tous les 1123px
3. **Console logs** : Positions Y exactes de chaque cut
4. **PDF viewer** : Vérifier zoom 200% pour la netteté

### Commande Debug
```javascript
// Dans generateCvPdf.js
const DEBUG = true;

if (DEBUG) {
  // Sauvegarder chaque slice
  await fs.writeFile(`debug-page-${i}.png`, slice);
  
  // Logger les positions
  console.log(`Cut ${i}: Y=${cutY}, Section=${sectionName}`);
}
```

## 📦 Dépendances Validées

- ✅ **Playwright** : Capture avec scroll automatique
- ✅ **sharp** : Redimensionnement haute qualité (lanczos3)
- ✅ **pdf-lib** : Composition PDF multi-pages
- ✅ **jsdom** : Manipulation HTML pour localization

## 🎓 Principe Clé

> **"Une fenêtre A4 virtuelle descend le long du document en scrollant, capturant exactement ce qu'elle voit à chaque position."**

C'est exactement ce que fait `fullPage: true` de Playwright, on doit juste découper le résultat intelligemment.
