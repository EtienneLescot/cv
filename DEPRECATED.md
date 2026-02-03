# DEPRECATED SCRIPTS

This folder contains deprecated scripts that are kept for reference but should no longer be used.

## Deprecated Files

### `generateCvPdf.js.deprecated`
**Deprecated on:** 2026-02-03  
**Reason:** Complexe, génère le HTML à la volée  
**Replaced by:** `generate-pdf.js`  
**Description:** Ancienne méthode de génération PDF qui chargeait les templates et générait le HTML dynamiquement. La nouvelle méthode utilise directement les fichiers HTML statiques générés par `build-static-locales.js`.

### `generateCvPdf-old-complex.js.backup`
**Deprecated on:** 2026-02-03  
**Reason:** Méthode ultra-complexe avec screenshot/tiling/stitching  
**Replaced by:** `generateCvPdf.js.deprecated` puis `generate-pdf.js`  
**Description:** Version originale avec 900+ lignes de code utilisant des screenshots, découpage en tuiles et assemblage. Remplacée par une approche simplifiée utilisant `page.pdf()` natif de Playwright.

## Migration Guide

### From `generateCvPdf.js.deprecated` to `generate-pdf.js`

**Old:**
```bash
node generateCvPdf.js --locale fr --theme dark
```

**New:**
```bash
node generate-pdf.js --locale fr --theme dark
# or use npm scripts:
npm run pdf
npm run pdf:all
```

**Key differences:**
- ✅ Plus simple : utilise directement les HTML générés
- ✅ Moins de dépendances : pas besoin de JSDOM/yaml
- ✅ Plus rapide : pas de génération HTML à la volée
- ✅ Plus fiable : le HTML web et PDF sont identiques

## Workflow Changes

**Before:**
1. Modifier `index-template.html`
2. `npm run build` (génère HTML statiques)
3. `npm run pdf` (charge template, génère HTML, export PDF)

**After:**
1. Modifier `index-template.html`
2. `npm run build` (génère HTML statiques)
3. `npm run pdf` (charge HTML statique, export PDF)

Le PDF est maintenant généré depuis exactement le même HTML que la version web, garantissant une cohérence parfaite.
