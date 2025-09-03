# CV d'Etienne Lescot

Cette page présente mon curriculum vitæ dans un style rétro des années 90. Elle peut être ouverte localement en affichant `index.html` ou déployée sur GitHub Pages.

## Aperçu
- Basculer entre mode sombre et clair avec le bouton en haut à droite.
- Langue détectée automatiquement (fr/en) avec un bouton pour changer.
- CSS séparée dans `style.css` pour faciliter les modifications.
- Support multilingue avec fichiers de traduction dans `locales/` (français et anglais) au format YAML pour une meilleure lisibilité.

## Utilisation
Clonez le dépôt puis ouvrez la page :

```bash
git clone <repo>
cd cv
open index.html # ou double‑cliquez sur le fichier
```

Vous pouvez aussi héberger les fichiers sur GitHub Pages afin d'accéder au CV en ligne.

## Serveur de développement local
Pour tester le CV avec un serveur local, utilisez le script `server.js` :

```bash
node server.js
```

Cela démarrera un serveur sur `http://localhost:3000` qui servira tous les fichiers du projet.

## Conversion HTML vers PDF
Pour générer un PDF à partir du CV, utilisez le script `html-to-pdf.js` :

```bash
node html-to-pdf.js [html_file] [css_file] [output_pdf] [safe_mode]
```

Par défaut, il utilise `index.html`, `style.css` et génère `output.pdf`. Le quatrième paramètre optionnel `safe_mode` permet d'activer le mode sécurisé pour les caractères spéciaux (true/false). Par exemple :

```bash
# Génération normale
node html-to-pdf.js index.html style.css cv.pdf

# Génération avec mode sécurisé pour les caractères spéciaux
node html-to-pdf.js index.html style.css cv-safe.pdf true
```

Cela générera un fichier PDF nommé `cv.pdf` ou `cv-safe.pdf` avec le style appliqué. Le mode sécurisé escape les caractères spéciaux dans le CSS pour éviter les problèmes d'affichage sur certaines plateformes.

## Ajout de nouvelles langues
Pour ajouter une nouvelle langue :

1. Créez un fichier YAML dans le dossier `locales/` (par exemple `es.yml` pour l'espagnol)
2. Copiez le contenu de `locales/en.yml` et traduisez les valeurs
3. La langue sera automatiquement détectée et disponible via le bouton de changement de langue

Le format YAML permet une meilleure lisibilité et la possibilité d'ajouter des commentaires dans les fichiers de traduction.

## Génération de fichiers statiques multilingues

### Build Process (Nouvelle Architecture SSG)
Le projet utilise maintenant une architecture de Static Site Generation (SSG) pour générer des fichiers HTML statiques pour chaque langue.

#### Commandes de build
```bash
# Générer tous les fichiers statiques pour chaque locale
npm run build

# Ou utiliser directement le script de build
npm run build:locales
```

#### Fichiers générés
- `index-fr.html` - Version française statique
- `index-en.html` - Version anglaise statique
- Les fichiers générés sont exclus du git via `.gitignore`

#### Déploiement
Les fichiers statiques peuvent être déployés directement sur n'importe quel serveur web ou CDN. Pour le déploiement, vous pouvez :
1. Utiliser GitHub Pages avec les fichiers générés
2. Déployer sur Netlify, Vercel ou tout autre service de static hosting
3. Servir les fichiers directement depuis un serveur web

#### Avantages
- ✅ Chargement instantané (pas de traitement client)
- ✅ SEO-friendly (contenu pré-rendu)
- ✅ Robuste (pas de corruption HTML)
- ✅ Facile à déployer

## Injection de données de secours (Déprécié)
L'ancien script `inject-fallback.js` est maintenant déprécié. Utilisez plutôt la nouvelle architecture SSG décrite ci-dessus.

Pour plus de détails sur l'architecture SSG, consultez [SSG_ARCHITECTURE.md](SSG_ARCHITECTURE.md).
