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

## Conversion HTML vers PDF (Pixel-Perfect)

Pour générer un PDF haute fidélité (identique à l'écran) avec texte sélectionnable :

```bash
# Générer le PDF par défaut (FR, Dark)
npm run pdf

# Générer toutes les variantes (FR/EN, Dark/Light)
npm run pdf:all
```

### Options disponibles

- `--locale <fr|en>` : Langue du CV (défaut: `fr`)
- `--theme <dark|light>` : Thème visuel (défaut: `dark`)
- `--scale <n>` : Facteur de qualité (ex: `2` pour rendu Retina/Print). Défaut: `1`.
- `--tiles <NxN>` : Découpage en tuiles (ex: `2x2`). Utile avec `--scale` élevé pour éviter les limites de mémoire du navigateur. Automatique si non spécifié.

Exemple pour un rendu haute qualité :
```bash
node generateCvPdf.js --scale 2
```

Le script utilise une approche hybride avancée :
1.  **Capture Visuelle** : Génère des images haute résolution via Playwright (pour un rendu CSS exact, sans hacks `@media print`).
2.  **Réhydratation** : Analyse le DOM HTML pour extraire le texte et sa position.
3.  **Injection** : Superpose une couche de texte invisible par-dessus les images.
4.  **Structuration** : Insère des séparateurs invisibles pour garantir un ordre de lecture logique (Gauche -> Droite, Haut -> Bas) compatible avec les ATS et le copier-coller.

Pour plus de détails techniques, voir [PDF_GENERATION_README.md](PDF_GENERATION_README.md).

## Ajout de nouvelles langues
Pour ajouter une nouvelle langue :

1. Créez un fichier YAML dans le dossier `locales/` (par exemple `es.yml` pour l'espagnol)
2. Copiez le contenu de `locales/en.yml` et traduisez les valeurs
3. La langue sera automatiquement détectée et disponible via le bouton de changement de langue

Le format YAML permet une meilleure lisibilité et la possibilité d'ajouter des commentaires dans les fichiers de traduction.

## Génération de fichiers statiques multilingues

### Build Process (Nouvelle Architecture SSG)
Le projet utilise maintenant une architecture de Static Site Generation (SSG) pour générer des fichiers HTML statiques pour chaque langue avec optimisation des performances.

#### Commandes de build
```bash
# Générer tous les fichiers statiques pour chaque locale avec optimisation
npm run build:full

# Ou utiliser les étapes séparées
npm run build:minify  # Minifie CSS et JS
npm run build:locales # Génère les fichiers HTML statiques
```

#### Fichiers générés
- `index-fr.html` - Version française statique avec JS minifié
- `index-en.html` - Version anglaise statique avec JS minifié
- `style.min.css` - CSS minifiée (10 KiB de gains)
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
- ✅ Performances optimisées :
  - CSS minifiée (10 KiB de gains)
  - JavaScript inline minifié (1.7 KiB de gains)
  - Cache efficace pour les assets statiques

## Injection de données de secours (Déprécié)
L'ancien script `inject-fallback.js` est maintenant déprécié. Utilisez plutôt la nouvelle architecture SSG décrite ci-dessus.

Pour plus de détails sur l'architecture SSG, consultez [SSG_ARCHITECTURE.md](SSG_ARCHITECTURE.md).
