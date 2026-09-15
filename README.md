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

Les PDF sont commités. La CI se contente de publier le dossier `site/` sur GitHub Pages.
