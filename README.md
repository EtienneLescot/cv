# CV d'Etienne Lescot

Cette page présente mon curriculum vitæ dans un style rétro des années 90. Elle peut être ouverte localement en affichant `index.html` ou déployée sur GitHub Pages.

## 📋 Aperçu

- Basculer entre mode sombre et clair avec le bouton en haut à droite
- Langue détectée automatiquement (fr/en) avec un bouton pour changer
- Support multilingue avec fichiers de traduction dans `locales/` (français et anglais) au format YAML
- Génération de PDFs haute qualité avec texte sélectionnable
- Déploiement automatique sur GitHub Pages

## 🚀 Démarrage rapide

### Installation

```bash
git clone <repo>
cd cv
npm install
npx playwright install --with-deps
```

### Build local

```bash
# Build complet (HTML + PDF)
npm run build

# Build uniquement le HTML
npm run build:web

# Build uniquement les PDFs
npm run build:pdf
```

Les fichiers générés se trouvent dans :
- `dist/web/` - Fichiers HTML et CSS (gitignored)
- `dist/pdf/` - Fichiers PDF (committés pour GitHub Pages)

### Serveur de développement

```bash
npm run dev
```

Ouvre le CV sur `http://localhost:3000`

## 🏗️ Structure du projet

```
cv/
├── dist/                      # Dossier de build
│   ├── web/                  # HTML/CSS générés (gitignored)
│   └── pdf/                  # PDFs (committés)
├── build.config.json         # Configuration des branches à builder
├── build.js                  # Script de build unifié
├── build-all-branches.js     # Build multi-branches (CI)
├── locales/                  # Fichiers de traduction YAML
│   ├── fr.yml
│   └── en.yml
├── fonts/                    # Polices Inter
├── scripts/
│   ├── clean.js             # Nettoyage des builds
│   └── migrate-to-dist.sh   # Migration export/ → dist/
└── .github/workflows/
    └── build-deploy.yml     # CI/CD GitHub Actions
```

## 📦 Système de build

### Configuration des branches

Le fichier [`build.config.json`](build.config.json) définit quelles branches sont buildées :

```json
{
  "branches": {
    "main": {
      "enabled": true,
      "outputPath": "",
      "displayName": "Version principale"
    },
    "360": {
      "enabled": true,
      "outputPath": "360",
      "displayName": "Vue 360°"
    }
  }
}
```

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur de développement local |
| `npm run build` | Build la branche courante (HTML + PDF) |
| `npm run build:web` | Build HTML uniquement |
| `npm run build:pdf` | Build PDFs uniquement |
| `npm run build:all-branches` | Build toutes les branches (utilisé par CI) |
| `npm run clean` | Nettoie tous les fichiers générés |
| `npm run clean:web` | Nettoie uniquement les fichiers web |
| `npm run clean:pdf` | Nettoie uniquement les PDFs |

## 🔄 Workflow CI/CD

Le workflow GitHub Actions ([`.github/workflows/build-deploy.yml`](.github/workflows/build-deploy.yml)) :

1. **Build** toutes les branches configurées dans `build.config.json`
2. **Commit** les PDFs dans `dist/pdf/` (nécessaire pour les URLs stables)
3. **Deploy** `dist/web/` vers GitHub Pages

Un second workflow ([`.github/workflows/build-pdf-commit.yml`](.github/workflows/build-pdf-commit.yml)) :

1. Se lance sur **toutes les branches poussées**
  - Sauf branches techniques: `dependabot/**` et `renovate/**`
2. Build les PDFs (`npm run build:pdf`)
  - Avec suppression du lien **CV en ligne** dans le PDF (flag `HIDE_ONLINE_CV_LINK=true`)
  - Mode simplifié: sortie toujours dans `dist/pdf/` (pas de sous-dossier lié à la branche) via `FORCE_FLAT_PDF_OUTPUT=true`
3. Commit automatiquement `dist/pdf/` sur la branche

### URLs déployées

- **Main** : `https://etiennelescot.github.io/cv/`
- **Branch 360** : `https://etiennelescot.github.io/cv/360/`
- **PDFs** : `https://etiennelescot.github.io/cv/pdf/cv-fr-dark.pdf`

## 📄 Génération de PDFs

Le système génère des PDFs haute fidélité avec :

- ✅ Texte sélectionnable (pas juste une image)
- ✅ Rendu CSS pixel-perfect
- ✅ Support des thèmes (dark/light)
- ✅ Multi-langues (fr/en)

### Comment ça marche ?

1. Génération des HTML statiques via Playwright
2. Capture avec CSS appliqué
3. Export en PDF natif (vectoriel)

Les PDFs sont générés dans `dist/pdf/` et committés dans Git car :
- Nécessaires pour les liens stables dans les pages HTML
- GitHub Actions artifacts expirent après 90 jours
- Pas d'alternative viable pour GitHub Pages

## 🌍 Ajout de nouvelles langues

1. Créez un fichier YAML dans `locales/` (ex: `es.yml` pour espagnol)
2. Copiez le contenu de `locales/en.yml` et traduisez
3. Ajoutez la locale dans `build.config.json` :

```json
{
  "locales": ["fr", "en", "es"]
}
```

4. Rebuild : `npm run build`

## 🔧 Ajout d'une nouvelle branche

Pour ajouter une variante du CV (ex: version DevOps) :

1. Créez la branche Git : `git checkout -b devops`
2. Modifiez le contenu du CV
3. Ajoutez la branche dans `build.config.json` :

```json
{
  "branches": {
    "devops": {
      "enabled": true,
      "outputPath": "devops",
      "displayName": "DevOps Focus"
    }
  }
}
```

4. Le CI va automatiquement builder et déployer vers `/cv/devops/`

## 🧹 Nettoyage

```bash
# Nettoyer tous les fichiers générés
npm run clean

# Nettoyer uniquement les HTML
npm run clean:web

# Nettoyer uniquement les PDFs
npm run clean:pdf
```

## 🐛 Dépannage

### Le build échoue

```bash
# Vérifier les dépendances
npm ci
npx playwright install --with-deps

# Nettoyer et rebuilder
npm run clean
npm run build
```

### Les PDFs ne sont pas générés

Vérifiez que Playwright est installé :

```bash
npx playwright install --with-deps
```

### Les liens PDF sont cassés

Les PDFs doivent être committés dans `dist/pdf/` pour que les liens fonctionnent sur GitHub Pages.

```bash
git add dist/pdf/
git commit -m "Update PDFs"
git push
```

## 📚 Documentation technique

Pour plus de détails sur l'architecture :

- [`plans/build-ci-reconciliation.md`](plans/build-ci-reconciliation.md) - Plan complet de migration
- [`plans/build-config-spec.md`](plans/build-config-spec.md) - Spécification de la configuration
- [`plans/implementation-comparison.md`](plans/implementation-comparison.md) - Comparaison ancien/nouveau système

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature : `git checkout -b feature/ma-feature`
3. Commit : `git commit -m 'Add feature'`
4. Push : `git push origin feature/ma-feature`
5. Ouvrez une Pull Request

## 📝 License

ISC
