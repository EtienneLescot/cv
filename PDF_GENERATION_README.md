# 📄 Génération PDF Production - Documentation

## 🎯 Objectif

Script **Playwright** robuste et déterministe pour générer des PDFs pixel-perfect de votre CV, identiques au rendu navigateur, **sans utiliser `@media print`**.

## ✅ Garanties

- ✅ Rendu **identique** entre navigateur et PDF
- ✅ Chargement **synchronisé** des webfonts
- ✅ Viewport **cohérent** avec format A4
- ✅ Media forcée en **"screen"** (pas "print")
- ✅ Pagination **maîtrisée** par le layout HTML
- ✅ **Déterministe** et reproductible en CI/CD

## 📋 Prérequis

```bash
# Node.js 18+
node --version

# Installation des dépendances
npm install

# Installation de Chromium (binaire Playwright)
npx playwright install chromium
```

## 🚀 Usage

### Génération simple (défaut: français, thème sombre)

```bash
npm run pdf
# ou
node generateCvPdf.js
```

### Générer toutes les combinaisons

```bash
npm run pdf:all
```

Génère automatiquement :
- `cv-fr-dark.pdf`
- `cv-fr-light.pdf`
- `cv-en-dark.pdf`
- `cv-en-light.pdf`

### Options avancées

```bash
# Français avec thème clair
node generateCvPdf.js --locale fr --theme light

# Anglais avec thème sombre
node generateCvPdf.js --locale en --theme dark

# Spécifier le chemin de sortie
node generateCvPdf.js --locale fr --theme dark --output ./mon-cv.pdf
```

## ✨ Réhydratation (Texte Sélectionnable)

Le script inclut automatiquement une étape de **réhydratation** :
1.  Génération d'un PDF "Raster" (Image) pour un rendu pixel-perfect.
2.  Extraction des coordonnées du texte depuis le HTML (DOM).
3.  Injection d'une couche de texte transparent par-dessus le PDF.
4.  Insertion de séparateurs structurels invisibles pour forcer l'ordre de lecture (copier-coller) et le support ATS.

Cette étape garantit que le texte est sélectionnable et que les colonnes ne sont pas mélangées lors du copier-coller.

## 🔧 Configuration

Toutes les configurations sont dans `generateCvPdf.js` :

```javascript
const CONFIG = {
  // Viewport A4 optimal (900px de large, redimensionné)
  viewport: { width: 900, height: 1273 },
  
  // Options de pagination
  pagination: {
    usePdfCss: true,  // Utiliser style-pdf.css
    smartBreak: true  // Découpage intelligent
  },
  
  // Timeouts (ms)
  timeout: {
    navigation: 30000,
    fonts: 10000,
    render: 5000
  }
}
```

## 🏗️ Architecture technique

### Pourquoi Playwright et pas Puppeteer ?

| Critère | Playwright | Puppeteer |
|---------|-----------|-----------|
| Maintenance | Active (Microsoft) | Active (Google) |
| API moderne | ✅ Promise-based | ✅ Promise-based |
| Multi-navigateurs | Chrome, Firefox, Safari | Chrome uniquement |
| TypeScript natif | ✅ Oui | Partiel |
| Documentation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Font loading API | ✅ Explicite | ⚠️ Implicite |

### Points clés du rendu

1. **Viewport fixe A4** : `794×1123px` (96 DPI standard)
2. **Synchronisation webfonts** : `document.fonts.ready` + vérification statut
3. **Media screen forcée** : Pas de `@media print`, rendu identique au navigateur
4. **Désactivation animations** : Rendu déterministe
5. **Network idle** : Attente complète du chargement

### Différences avec l'ancien script (html-to-pdf.js)

| Aspect | Ancien (Puppeteer) | Nouveau (Playwright) |
|--------|-------------------|---------------------|
| Fonts | ❌ Non vérifié | ✅ Explicite |
| Viewport | ❌ Non fixé | ✅ A4 optimal |
| Media | ⚠️ Mixte print/screen | ✅ Screen uniquement |
| Animations | ❌ Actives | ✅ Désactivées |
| CI/CD | ⚠️ Instable | ✅ Robuste |

## 🐛 Debugging

### Le PDF est vide ou corrompu

```bash
# 1. Vérifier que Chromium est bien installé
npx playwright install chromium

# 2. Activer les logs détaillés (modifier le script)
# Ajouter dans chromium.launch():
logger: {
  isEnabled: () => true,
  log: (name, severity, message) => console.log(`[${severity}] ${message}`)
}

# 3. Sauvegarder un screenshot pour debug
# Ajouter avant page.pdf():
await page.screenshot({ path: 'debug-render.png', fullPage: true });
```

### Les fonts ne s'affichent pas

Le script vérifie déjà `document.fonts.ready`. Si problème persistant :

1. Vérifier que les fonts sont bien chargées dans le HTML
2. Augmenter `CONFIG.timeout.fonts` à 20000ms
3. Forcer un rechargement : `await page.reload()`

### Différences de rendu entre navigateur et PDF

1. Vérifier que le viewport est bien `794×1123px`
2. S'assurer qu'aucun `@media print` n'est appliqué
3. Désactiver les animations CSS (déjà fait par le script)
4. Tester avec `await page.screenshot()` pour comparer

## 🔄 Intégration CI/CD

### GitHub Actions

Voir [.github/workflows/generate-pdf.yml](.github/workflows/generate-pdf.yml)

### GitLab CI

```yaml
generate-pdfs:
  image: mcr.microsoft.com/playwright:v1.49.1
  script:
    - npm ci
    - npm run pdf:all
  artifacts:
    paths:
      - exports/*.pdf
    expire_in: 30 days
```

### Docker

```dockerfile
FROM mcr.microsoft.com/playwright:v1.49.1

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run pdf:all
```

## 📊 Performance

- **Temps moyen** : 3-8 secondes par PDF
- **Mémoire** : ~200-400 MB par instance Chromium
- **Taille PDF** : ~100-300 KB selon le contenu

## 🔒 Sécurité

- ✅ Pas de secrets requis
- ✅ Sandbox Chromium désactivé en CI (`--no-sandbox`) - normal et sécurisé
- ✅ Pas de connexion réseau externe requise
- ✅ Génération locale uniquement

## 📚 Ressources

- [Playwright Documentation](https://playwright.dev/)
- [PDF Generation Best Practices](https://playwright.dev/docs/api/class-page#page-pdf)
- [Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready)

## 📝 Checklist complète

Voir [CHECKLIST_CI_CD.md](CHECKLIST_CI_CD.md) pour la checklist détaillée d'intégration CI/CD.

---

**Questions ?** Ouvrir une issue sur le repo.
