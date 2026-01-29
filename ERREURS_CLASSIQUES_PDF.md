# 🚨 Erreurs classiques à éviter - Génération PDF headless

## 1. ❌ Utiliser `@media print` pour le PDF

### Pourquoi c'est une erreur

Les règles `@media print` sont **imprévisibles** en mode headless :
- Comportement différent entre navigateurs
- Modifications CSS non maîtrisées (marges, couleurs, backgrounds)
- Rendu PDF ≠ rendu écran
- Impossible de tester visuellement avant génération

### ✅ Solution

Forcer le rendu avec **`media="screen"`** et concevoir le layout HTML directement pour A4. Le PDF sera alors **identique** au navigateur.

```javascript
// ❌ MAUVAIS
await page.emulateMedia({ media: 'print' });

// ✅ BON
// Pas besoin d'émuler, screen par défaut
await page.pdf({ printBackground: true });
```

---

## 2. ❌ Ne pas attendre le chargement des webfonts

### Symptômes

- Fonts fallback (Arial/Times au lieu de votre webfont)
- Rendu instable entre générations
- Différences de mise en page

### Pourquoi c'est critique

`waitUntil: 'networkidle0'` **ne garantit PAS** que les fonts sont rendues. Le navigateur peut télécharger les fonts mais ne pas encore les appliquer.

### ✅ Solution

Utiliser l'API `document.fonts.ready` explicitement :

```javascript
// ✅ Attendre explicitement les fonts
await page.waitForFunction(
  () => document.fonts.ready,
  { timeout: 10000 }
);

// Vérification supplémentaire
const allFontsLoaded = await page.evaluate(() => {
  return Array.from(document.fonts).every(font => font.status === 'loaded');
});
```

---

## 3. ❌ Viewport non défini ou incohérent

### Symptômes

- Layout responsive activé par erreur
- Débordements de contenu
- Pagination aléatoire

### Pourquoi c'est une erreur

Sans viewport fixe, Chromium utilise un viewport par défaut (souvent 800×600), ce qui peut déclencher :
- Media queries responsive
- Calculs de layout incorrects
- Débordements non prévus

### ✅ Solution

Définir un viewport **fixe** correspondant à A4 en pixels :

```javascript
// ✅ Viewport A4 optimal (96 DPI)
const context = await browser.newContext({
  viewport: {
    width: 794,   // 210mm à 96 DPI
    height: 1123  // 297mm à 96 DPI
  },
  deviceScaleFactor: 1  // Pas de scaling
});
```

---

## 4. ❌ Oublier `printBackground: true`

### Symptômes

- Fonds blancs dans le PDF alors qu'ils sont colorés dans le navigateur
- Dégradés, ombres, borders manquants

### Pourquoi

Par défaut, les navigateurs **suppriment** les backgrounds en impression pour économiser l'encre.

### ✅ Solution

```javascript
// ✅ Toujours activer printBackground
await page.pdf({
  path: 'output.pdf',
  printBackground: true  // ESSENTIEL
});
```

---

## 5. ❌ Dépendre de `window.print()` ou GUI

### Pourquoi c'est incompatible CI/CD

- Nécessite un environnement graphique (X11, Wayland)
- Dialogue d'impression = blocage du pipeline
- Paramètres non contrôlables

### ✅ Solution

Utiliser directement l'API headless :

```javascript
// ❌ MAUVAIS
await page.evaluate(() => window.print());

// ✅ BON
await page.pdf({ path: 'cv.pdf' });
```

---

## 6. ❌ Animations CSS actives pendant la génération

### Symptômes

- Rendu non déterministe (différent à chaque génération)
- Transitions en cours au moment du snapshot PDF

### ✅ Solution

Désactiver toutes les animations et transitions :

```javascript
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `
});
```

---

## 7. ❌ Utiliser des outils obsolètes (wkhtmltopdf, PhantomJS)

### Pourquoi éviter

- **wkhtmltopdf** : basé sur WebKit obsolète (2013), pas de support Flexbox/Grid moderne
- **PhantomJS** : projet abandonné (2018)
- **jsPDF** : génère du PDF depuis zéro = pas de rendu HTML/CSS

### ✅ Solution

Utiliser un moteur moderne et maintenu :
- ✅ **Playwright** (recommandé)
- ✅ Puppeteer (alternative acceptable)

---

## 8. ❌ Marges PDF au lieu de marges CSS

### Problème

Les marges définies dans `page.pdf()` sont **appliquées par le moteur PDF**, pas par le layout HTML.

```javascript
// ⚠️ Ces marges réduisent la zone de contenu
await page.pdf({
  margin: { top: '20mm', left: '15mm' }
});
```

### Effet

- Content peut déborder si le HTML ne le prévoit pas
- Pagination cassée si le CSS a déjà des marges

### ✅ Solution

Gérer les marges **dans le CSS** uniquement :

```css
.page {
  width: 210mm;
  height: 297mm;
  padding: 20mm 15mm;  /* Marges internes */
  box-sizing: border-box;
}
```

```javascript
// PDF sans marges supplémentaires
await page.pdf({
  margin: { top: 0, bottom: 0, left: 0, right: 0 }
});
```

---

## 9. ❌ Ne pas tester en conditions CI

### Symptômes

- Fonctionne localement, échoue en CI
- Fonts manquantes en CI
- Erreurs "No X11 display"

### Causes fréquentes

1. **Dépendances système manquantes** (libnss3, libatk, etc.)
2. **Fonts système non installées**
3. **Chromium non installé**

### ✅ Solution

1. **Installer les dépendances Playwright** :
   ```bash
   npx playwright install --with-deps chromium
   ```

2. **Utiliser l'image Docker officielle** :
   ```dockerfile
   FROM mcr.microsoft.com/playwright:v1.49.1
   ```

3. **Forcer headless vrai** :
   ```javascript
   await chromium.launch({
     headless: true,
     args: ['--no-sandbox']  // Nécessaire en CI
   });
   ```

---

## 10. ❌ Ignorer les différences de DPI

### Problème

Les navigateurs utilisent **96 DPI** par défaut, mais certains systèmes (macOS Retina) peuvent avoir un `deviceScaleFactor` > 1.

### Effet

- PDF plus gros que prévu
- Layout décalé

### ✅ Solution

Forcer `deviceScaleFactor: 1` :

```javascript
const context = await browser.newContext({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 1  // Toujours 1:1
});
```

---

## 📋 Checklist finale avant production

- [ ] Viewport fixe A4 (794×1123px)
- [ ] `printBackground: true`
- [ ] Attente explicite des webfonts (`document.fonts.ready`)
- [ ] Animations CSS désactivées
- [ ] Media screen (pas print)
- [ ] Marges gérées en CSS uniquement
- [ ] Testé en environnement CI
- [ ] Rendu déterministe (même PDF à chaque run)
- [ ] Pas de dépendance GUI (`window.print`)
- [ ] Playwright/Chromium moderne

---

**Suivez ces règles et votre génération PDF sera robuste, fiable et déterministe en production.** 🚀
