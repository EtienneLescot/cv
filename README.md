# CV d'Etienne Lescot

CV générique en français et en anglais, publié sur https://etiennelescot.github.io/cv/.

- `site/index.html` : CV en français
- `site/index-en.html` : CV en anglais
- `site/styles.css` : mise en forme commune, écran et impression A4
- `site/cv-fr.pdf`, `site/cv-en.pdf` : PDF générés

## Régénérer les PDF

```bash
npm install
npm run build
```

Le script imprime chaque page en PDF avec Edge ou Chrome installé en local.
`CV_BROWSER_PATH` permet d'imposer un navigateur.

Il contrôle aussi le rendu : place libre en bas de chaque page, en mm, et échec si une page déborde.

## Candidatures

Chaque candidature vit dans `candidatures/<poste>/`, ignoré par git : le dépôt est public.

- CV : copie de `site/index.html` ou `site/index-en.html`, feuille de style pointée sur `../../site/styles.css`
- Lettre : copie de `modeles/lettre.html`

```bash
npm run build -- candidatures/<poste>/CV-Etienne-Lescot-<Poste>.html candidatures/<poste>/Lettre-Etienne-Lescot-<Poste>.html
```

Chaque PDF est écrit à côté de son fichier HTML, sous le même nom.

Les PDF sont commités. La CI se contente de publier le dossier `site/` sur GitHub Pages.
