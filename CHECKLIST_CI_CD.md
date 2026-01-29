###############################################################################
# CHECKLIST CI/CD - Génération PDF automatisée
###############################################################################
#
# Cette checklist vous guide pour intégrer le script de génération PDF
# dans un pipeline CI/CD (GitHub Actions, GitLab CI, etc.)
#
###############################################################################

## 1. PRÉREQUIS ENVIRONNEMENT

✅ Node.js 18+ installé
✅ Playwright installé avec ses dépendances système:
   ```bash
   npx playwright install --with-deps chromium
   ```

✅ En environnement Docker/CI, installer les dépendances système:
   ```dockerfile
   # Exemple pour Ubuntu/Debian
   RUN apt-get update && apt-get install -y \
       libnss3 \
       libnspr4 \
       libatk1.0-0 \
       libatk-bridge2.0-0 \
       libcups2 \
       libdrm2 \
       libxkbcommon0 \
       libxcomposite1 \
       libxdamage1 \
       libxrandr2 \
       libgbm1 \
       libasound2 \
       libpango-1.0-0 \
       libcairo2
   ```

## 2. VARIABLES D'ENVIRONNEMENT CI

Aucune variable d'environnement requise par défaut.
Le script est standalone et déterministe.

## 3. COMMANDES DE BUILD

```bash
# Installation des dépendances
npm ci

# Installation de Playwright + Chromium
npx playwright install --with-deps chromium

# Génération des PDFs (toutes les combinaisons)
node generate-pdf-production.js --locale fr --theme dark
node generate-pdf-production.js --locale fr --theme light
node generate-pdf-production.js --locale en --theme dark
node generate-pdf-production.js --locale en --theme light
```

## 4. VALIDATION DES OUTPUTS

✅ Vérifier que les PDFs sont générés dans ./exports/
✅ Taille des fichiers > 0 Ko
✅ Format PDF valide (testable avec pdfinfo, ghostscript, etc.)

```bash
# Exemple validation
test -f exports/cv-fr-dark.pdf && echo "✅ PDF français dark OK"
test -s exports/cv-fr-dark.pdf || exit 1  # Fail si fichier vide
```

## 5. ARTIFACTS / STORAGE

GitHub Actions: Uploader les PDFs en artifacts
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: cv-pdfs
    path: exports/*.pdf
```

GitLab CI: Utiliser artifacts
```yaml
artifacts:
  paths:
    - exports/*.pdf
  expire_in: 30 days
```

## 6. OPTIMISATIONS PERFORMANCE CI

✅ Cache des node_modules:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

✅ Cache de Playwright (binaires Chromium):
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.cache/ms-playwright
       key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
   ```

## 7. TESTS DE RÉGRESSION (OPTIONNEL)

Pour détecter des changements de rendu non intentionnels:

1. Comparer la taille des PDFs générés
2. Utiliser des outils comme pdf-diff ou pdf2image + imagemagick
3. Extraire le texte avec pdftotext et comparer

Exemple:
```bash
# Extraire le texte du PDF pour vérification
pdftotext exports/cv-fr-dark.pdf - | grep "Etienne Lescot"
```

## 8. DEBUGGING EN CI

Si le PDF est vide ou corrompu:

✅ Vérifier les logs Playwright (augmenter verbosité):
   ```javascript
   browser = await chromium.launch({ 
     headless: true,
     logger: {
       isEnabled: () => true,
       log: (name, severity, message) => console.log(`[${severity}] ${message}`)
     }
   });
   ```

✅ Sauvegarder un screenshot avant génération PDF:
   ```javascript
   await page.screenshot({ path: 'debug-render.png', fullPage: true });
   ```

✅ Sauvegarder le HTML généré pour inspection:
   ```javascript
   fs.writeFileSync('debug.html', localizedHtml);
   ```

## 9. SÉCURITÉ

✅ Ne PAS committer les PDFs générés (ajouter à .gitignore)
✅ Pas de secrets requis pour ce script
✅ Sandbox Chromium désactivé en CI (--no-sandbox) - normal et sécurisé

## 10. MONITORING

✅ Temps de génération typique: 3-8 secondes par PDF
✅ Mémoire utilisée: ~200-400 MB par instance Chromium
✅ Alerter si le temps dépasse 30s (signe de problème)

###############################################################################
# EXEMPLE COMPLET - GitHub Actions Workflow
###############################################################################

Voir le fichier .github/workflows/generate-pdf.yml pour un exemple complet.

###############################################################################
