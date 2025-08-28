# CV d'Etienne Lescot

Cette page présente mon curriculum vitæ dans un style rétro des années 90. Elle peut être ouverte localement en affichant `index.html` ou déployée sur GitHub Pages.

## Aperçu
- Basculer entre mode sombre et clair avec le bouton en haut à droite.
- Langue détectée automatiquement (fr/en) avec un bouton pour changer.
- CSS séparée dans `style.css` pour faciliter les modifications.
- Support multilingue avec fichiers de traduction dans `locales/` (français et anglais).

## Utilisation
Clonez le dépôt puis ouvrez la page :

```bash
git clone <repo>
cd cv
open index.html # ou double‑cliquez sur le fichier
```

Vous pouvez aussi héberger les fichiers sur GitHub Pages afin d'accéder au CV en ligne.

## Conversion HTML vers PDF
Pour générer un PDF à partir du CV, utilisez le script `html-to-pdf.js` :

```bash
node html-to-pdf.js [html_file] [css_file] [output_pdf]
```

Par défaut, il utilise `index.html`, `style.css` et génère `output.pdf`. Par exemple :

```bash
node html-to-pdf.js index.html style.css cv.pdf
```

Cela générera un fichier PDF nommé `cv.pdf` avec le style appliqué.

## Ajout de nouvelles langues
Pour ajouter une nouvelle langue :

1. Créez un fichier JSON dans le dossier `locales/` (par exemple `es.json` pour l'espagnol)
2. Copiez le contenu de `locales/en.json` et traduisez les valeurs
3. La langue sera automatiquement détectée et disponible via le bouton de changement de langue

## Injection de données de secours
Pour garantir que le CV reste fonctionnel même si les fichiers de traduction sont manquants, utilisez le script `inject-fallback.js` :

```bash
node inject-fallback.js
```

Ce script injecte les traductions françaises directement dans le HTML comme contenu de secours pour tous les éléments avec des attributs `data-i18n`.
