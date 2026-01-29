/**
 * ============================================================================
 * CV PDF GENERATOR - Screenshot to PDF Approach
 * ============================================================================
 * 
 * Cette approche garantit un rendu IDENTIQUE au navigateur :
 * 1. Capture un screenshot complet du CV en mode "screen"
 * 2. Découpe intelligemment l'image en tranches de hauteur A4
 * 3. Recompose un PDF multi-pages à partir des tranches
 * 
 * ✅ Pas de @media print appliqué
 * ✅ Rendu pixel-perfect identique à l'écran
 * ✅ Pagination intelligente basée sur le contenu
 * ✅ Fonts et ressources synchronisées
 * 
 * USAGE:
 *   node generateCvPdf.js
 *   node generateCvPdf.js --locale fr --theme dark
 *   node generateCvPdf.js --url http://localhost:3000
 * 
 * @requires @playwright/test pdf-lib sharp
 */

const { chromium } = require('@playwright/test');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('yaml');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Source HTML
  templatePath: path.join(__dirname, 'index-template.html'),
  localesPath: path.join(__dirname, 'locales'),
  cssPath: path.join(__dirname, 'style.css'),
  cssPdfPath: path.join(__dirname, 'style-pdf.css'),  // CSS spécifique PDF
  
  // Options disponibles
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light'],
  
  // Viewport optimal pour capturer le CV
  // Largeur basée sur le container max-width (900px) + marge
  viewport: {
    width: 1000,
    height: 1400  // Sera étendu automatiquement par fullPage
  },
  
  // Dimensions A4 en pixels (96 DPI)
  a4: {
    widthPx: 794,   // 210mm à 96 DPI
    heightPx: 1123  // 297mm à 96 DPI
  },
  
  // Options de pagination
  pagination: {
    usePdfCss: true,  // Utiliser style-pdf.css au lieu du zoom
    targetPages: null,  // Nombre de pages cibles (null = auto, utilisé seulement si usePdfCss = false)
    smartBreak: true,  // Découpage intelligent aux limites de sections
    breakSelectors: ['.section', '.experience-item', '.project-item', 'h2'],  // Éléments à ne pas couper
    minSectionHeight: 100  // Hauteur minimale pour considérer une section
  },
  
  // Timeouts (ms)
  timeout: {
    navigation: 30000,
    fonts: 10000,
    render: 5000
  },
  
  // Output
  outputDir: './exports',
  tempDir: './exports/temp'
};

// ============================================================================
// UTILITIES - Chargement des données localisées
// ============================================================================

/**
 * Charge les données YAML pour une locale donnée
 */
function loadLocale(localeName) {
  try {
    const yamlPath = path.join(CONFIG.localesPath, `${localeName}.yml`);
    const yamlContent = fsSync.readFileSync(yamlPath, 'utf8');
    return yaml.parse(yamlContent);
  } catch (error) {
    console.error(`❌ Erreur chargement locale ${localeName}:`, error.message);
    return null;
  }
}

/**
 * Génère le HTML localisé avec thème
 */
function generateLocalizedHtml(templateHtml, localeData, localeName, themeName) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;

  document.documentElement.lang = localeName;
  document.documentElement.setAttribute('data-theme', themeName);

  if (localeData.title) document.title = localeData.title;

  // Meta tags
  const metaSelectors = {
    'meta[name="description"]': localeData['profile-desc'],
    'meta[name="keywords"]': localeData.keywords,
    'meta[name="author"]': localeData.name,
    'meta[property="og:title"]': localeData.title,
    'meta[property="og:description"]': localeData['profile-desc'],
    'meta[name="twitter:title"]': localeData.title,
    'meta[name="twitter:description"]': localeData['profile-desc']
  };

  Object.entries(metaSelectors).forEach(([selector, content]) => {
    const element = document.querySelector(selector);
    if (element && content) {
      element.setAttribute('content', content);
    }
  });

  // Labels ARIA
  const ariaElements = {
    'lang-button': localeData['lang-label'],
    'toggle': localeData['theme-label'],
    'print-btn': localeData['download-label']
  };

  Object.entries(ariaElements).forEach(([id, label]) => {
    const element = document.getElementById(id);
    if (element && label) element.setAttribute('aria-label', label);
  });

  // Traductions i18n
  const i18nElements = document.querySelectorAll('[data-i18n]');
  i18nElements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = localeData[key];
    if (translation !== undefined) element.innerHTML = translation;
  });

  return dom.serialize();
}

// ============================================================================
// PLAYWRIGHT - Capture du rendu screen
// ============================================================================

/**
 * Attend explicitement que toutes les webfonts soient chargées
 */
async function waitForFonts(page) {
  try {
    await page.waitForFunction(
      () => document.fonts.ready,
      { timeout: CONFIG.timeout.fonts }
    );
    
    const allFontsLoaded = await page.evaluate(() => {
      return Array.from(document.fonts).every(font => font.status === 'loaded');
    });

    if (!allFontsLoaded) {
      console.warn('⚠️  Certaines fonts ne sont pas chargées, attente supplémentaire...');
      await page.waitForTimeout(1000);
    }

    const fontCount = await page.evaluate(() => document.fonts.size);
    console.log(`✓ ${fontCount} webfont(s) chargée(s)`);
    
    return true;
  } catch (error) {
    console.warn('⚠️  Timeout attente fonts:', error.message);
    return false;
  }
}

/**
 * Attend la stabilité complète du DOM
 */
async function waitForLayoutStability(page) {
  await page.waitForLoadState('networkidle', { 
    timeout: CONFIG.timeout.navigation 
  });
  
  await page.waitForTimeout(CONFIG.timeout.render);
  
  const imagesLoaded = await page.evaluate(() => {
    const images = Array.from(document.images);
    return images.every(img => img.complete && img.naturalHeight !== 0);
  });
  
  if (!imagesLoaded) {
    console.warn('⚠️  Certaines images ne sont pas chargées');
  }
  
  console.log('✓ Layout stabilisé');
}

/**
 * Prépare la page pour la capture (désactive animations, masque boutons UI)
 * Applique le mode PDF via CSS au lieu du zoom
 */
async function preparePage(page, usePdfMode = true) {
  // Désactiver les animations
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
  
  // Masquer les boutons d'interface
  await page.evaluate(() => {
    const buttonsToHide = document.querySelectorAll(
      '#print-btn, #toggle, #lang-button, .lang-dropdown, .top-right-buttons'
    );
    buttonsToHide.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  });
  
  // Activer le mode PDF si demandé
  if (usePdfMode) {
    await page.evaluate(() => {
      document.documentElement.classList.add('pdf-mode');
    });
    console.log('✓ Mode PDF activé (style-pdf.css appliqué)');
  }
  
  console.log('✓ Page préparée pour capture');
}

/**
 * Analyse le DOM pour trouver les positions des sections
 * Retourne un tableau de positions Y où il est "safe" de couper
 */
async function findSafeCutPoints(page) {
  return await page.evaluate((config) => {
    const cutPoints = [0];  // Début du document
    
    // Trouver tous les éléments qui correspondent aux sélecteurs
    const elements = [];
    config.pagination.breakSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => elements.push(el));
    });
    
    // Récupérer les positions Y de ces éléments
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const absoluteY = rect.top + scrollY;
      
      // Ajouter uniquement si l'élément a une hauteur significative
      if (rect.height >= config.pagination.minSectionHeight) {
        cutPoints.push(Math.round(absoluteY));
      }
    });
    
    // Trier et dédupliquer
    return [...new Set(cutPoints)].sort((a, b) => a - b);
  }, CONFIG);
}

/**
 * Capture un screenshot complet de la page en mode screen
 */
async function captureScreenshot(localizedHtml, tempScreenshotPath, themeName, usePdfMode = true) {
  let browser;
  
  try {
    console.log('\n🚀 Lancement de Chromium...');
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-web-security',
        '--font-render-hinting=none',
        '--disable-gpu',
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext({
      viewport: CONFIG.viewport,
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      colorScheme: themeName === 'dark' ? 'dark' : 'light'
    });

    const page = await context.newPage();
    
    // CRITIQUE: Forcer media='screen' pour éviter @media print
    await page.emulateMedia({ media: 'screen' });
    
    console.log('✓ Navigateur initialisé');
    console.log(`  Viewport: ${CONFIG.viewport.width}px largeur`);
    console.log(`  Media: screen (${themeName}) - @media print désactivé`);
    console.log(`  Mode: ${usePdfMode ? 'PDF CSS optimisé' : 'Screen standard'}`);

    console.log('\n📄 Chargement du HTML...');
    await page.setContent(localizedHtml, {
      waitUntil: 'domcontentloaded'
    });

    console.log('\n⏳ Synchronisation du rendu...');
    await waitForFonts(page);
    await waitForLayoutStability(page);
    await preparePage(page, usePdfMode);

    // Analyser les points de coupure potentiels
    let safeCutPoints = null;
    if (CONFIG.pagination.smartBreak) {
      console.log('\n🔍 Analyse des sections pour découpage intelligent...');
      safeCutPoints = await findSafeCutPoints(page);
      console.log(`✓ ${safeCutPoints.length} point(s) de coupure détecté(s)`);
    }

    console.log('\n📸 Capture du screenshot complet...');
    await page.screenshot({ 
      path: tempScreenshotPath,
      fullPage: true,  // Capture TOUTE la page, même si elle est longue
      type: 'png'
    });
    
    // Récupérer les dimensions réelles de la page capturée
    const dimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      };
    });
    
    console.log(`✓ Screenshot capturé: ${dimensions.width}×${dimensions.height}px`);
    
    await browser.close();
    
    return { dimensions, safeCutPoints };
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la capture:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

// ============================================================================
// IMAGE PROCESSING - Découpage en tranches A4
// ============================================================================

/**
 * Découpe le screenshot en tranches A4 avec découpage intelligent
 * Retourne un tableau de buffers PNG
 */
async function sliceScreenshotIntoA4Pages(screenshotPath, screenshotDimensions, safeCutPoints = null) {
  console.log('\n✂️  Découpage du screenshot en pages A4...');
  
  const image = sharp(screenshotPath);
  const metadata = await image.metadata();
  
  console.log(`  Dimensions image: ${metadata.width}×${metadata.height}px`);
  console.log(`  Dimensions A4 cible: ${CONFIG.a4.widthPx}×${CONFIG.a4.heightPx}px`);
  
  // Calculer le ratio pour redimensionner à la largeur A4
  const scaleRatio = CONFIG.a4.widthPx / metadata.width;
  const scaledHeight = Math.round(metadata.height * scaleRatio);
  
  console.log(`  Ratio de redimensionnement: ${scaleRatio.toFixed(3)}`);
  console.log(`  Hauteur après redimensionnement: ${scaledHeight}px`);
  
  // Redimensionner l'image à la largeur A4
  const resizedImage = await image
    .resize(CONFIG.a4.widthPx, scaledHeight, {
      fit: 'fill',
      kernel: 'lanczos3'  // Meilleure qualité de redimensionnement
    })
    .png()
    .toBuffer();
  
  // Calculer les points de coupure optimaux
  let cutPositions;
  
  if (safeCutPoints && safeCutPoints.length > 0) {
    console.log('  Mode découpage intelligent activé');
    
    // Convertir les safe cut points en coordonnées de l'image redimensionnée
    const scaledCutPoints = safeCutPoints.map(y => Math.round(y * scaleRatio));
    
    // Trouver les meilleurs points de coupure pour maximiser l'utilisation des pages
    cutPositions = findOptimalCutPositions(scaledCutPoints, scaledHeight, CONFIG.a4.heightPx);
    console.log(`  Points de coupure optimisés: ${cutPositions.join(', ')}`);
  } else {
    // Découpage simple tous les CONFIG.a4.heightPx
    const numPages = Math.ceil(scaledHeight / CONFIG.a4.heightPx);
    cutPositions = Array.from({ length: numPages }, (_, i) => i * CONFIG.a4.heightPx);
    console.log(`  Mode découpage automatique: ${cutPositions.length} page(s)`);
  }
  
  // Découper en tranches
  const slices = [];
  for (let i = 0; i < cutPositions.length; i++) {
    const top = cutPositions[i];
    const bottom = cutPositions[i + 1] || scaledHeight;
    const height = Math.min(CONFIG.a4.heightPx, bottom - top);
    
    console.log(`  Page ${i + 1}: extraction de ${top}px à ${top + height}px`);
    
    // Créer une image A4
    const slice = await sharp({
      create: {
        width: CONFIG.a4.widthPx,
        height: CONFIG.a4.heightPx,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: await sharp(resizedImage)
        .extract({
          left: 0,
          top: top,
          width: CONFIG.a4.widthPx,
          height: height
        })
        .toBuffer(),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
    
    slices.push(slice);
  }
  
  console.log(`✓ ${slices.length} page(s) créée(s)`);
  
  return slices;
}

/**
 * Trouve les positions de coupure optimales basées sur les safe cut points
 * pour maximiser l'utilisation des pages A4
 */
function findOptimalCutPositions(safeCutPoints, totalHeight, pageHeight) {
  const positions = [0];
  let currentPos = 0;
  
  while (currentPos < totalHeight) {
    const idealNextPos = currentPos + pageHeight;
    
    if (idealNextPos >= totalHeight) {
      break;  // Dernière page
    }
    
    // Trouver le safe cut point le plus proche de idealNextPos
    // Priorité aux points AVANT idealNextPos pour éviter de déborder
    let bestCutPoint = idealNextPos;
    let minDistance = Infinity;
    
    for (const cutPoint of safeCutPoints) {
      if (cutPoint > currentPos && cutPoint <= idealNextPos + 100) {  // Tolérance de 100px après
        const distance = Math.abs(cutPoint - idealNextPos);
        if (distance < minDistance) {
          minDistance = distance;
          bestCutPoint = cutPoint;
        }
      }
    }
    
    positions.push(bestCutPoint);
    currentPos = bestCutPoint;
  }
  
  return positions;
}

// ============================================================================
// PDF GENERATION - Composition du PDF final
// ============================================================================

/**
 * Crée un PDF multi-pages à partir des tranches d'images
 */
async function createPdfFromSlices(slices, outputPath) {
  console.log('\n📝 Création du PDF final...');
  
  const pdfDoc = await PDFDocument.create();
  
  // Dimensions A4 en points (1 point = 1/72 inch)
  // A4 = 210mm × 297mm = 595.28pt × 841.89pt
  const a4Width = 595.28;
  const a4Height = 841.89;
  
  for (let i = 0; i < slices.length; i++) {
    console.log(`  Ajout de la page ${i + 1}/${slices.length}...`);
    
    // Créer une nouvelle page A4
    const page = pdfDoc.addPage([a4Width, a4Height]);
    
    // Embed l'image PNG dans le PDF
    const pngImage = await pdfDoc.embedPng(slices[i]);
    
    // Dessiner l'image pour remplir toute la page
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: a4Width,
      height: a4Height
    });
  }
  
  console.log('  Écriture du fichier PDF...');
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  
  console.log(`✓ PDF créé: ${slices.length} page(s)`);
}

// ============================================================================
// MAIN - Point d'entrée du script
// ============================================================================

/**
 * Parse les arguments CLI
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    locale: 'fr',
    theme: 'dark',
    output: null,
    url: null,
    pages: CONFIG.pagination.targetPages  // Nombre de pages cibles
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) {
      options.locale = args[i + 1];
      i++;
    } else if (args[i] === '--theme' && args[i + 1]) {
      options.theme = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      options.url = args[i + 1];
      i++;
    } else if (args[i] === '--pages' && args[i + 1]) {
      options.pages = parseInt(args[i + 1]);
      i++;
    }
  }

  return options;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('============================================================');
  console.log('  CV PDF GENERATOR - Screenshot to PDF');
  console.log('============================================================\n');

  try {
    const options = parseCliArgs();
    const selectedLocale = CONFIG.supportedLocales.includes(options.locale) 
      ? options.locale 
      : CONFIG.supportedLocales[0];
    const selectedTheme = CONFIG.supportedThemes.includes(options.theme)
      ? options.theme
      : CONFIG.supportedThemes[0];

    console.log(`📋 Configuration:`);
    console.log(`   Locale: ${selectedLocale}`);
    console.log(`   Theme: ${selectedTheme}`);
    if (options.pages) {
      console.log(`   Pages cibles: ${options.pages}`);
    }

    // Création des répertoires
    if (!fsSync.existsSync(CONFIG.outputDir)) {
      fsSync.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    if (!fsSync.existsSync(CONFIG.tempDir)) {
      fsSync.mkdirSync(CONFIG.tempDir, { recursive: true });
    }

    // Chemin de sortie
    const outputFileName = `cv-${selectedLocale}-${selectedTheme}.pdf`;
    const outputPath = options.output || path.join(CONFIG.outputDir, outputFileName);
    console.log(`   Output: ${outputPath}\n`);

    // Chargement du template et de la locale
    console.log('📚 Chargement des ressources...');
    const templateHtml = fsSync.readFileSync(CONFIG.templatePath, 'utf8');
    const localeData = loadLocale(selectedLocale);
    
    if (!localeData) {
      throw new Error(`Impossible de charger la locale: ${selectedLocale}`);
    }
    console.log('✓ Template et locale chargés');

    // Génération du HTML localisé
    console.log('\n🔧 Génération du HTML localisé...');
    let localizedHtml = generateLocalizedHtml(
      templateHtml, 
      localeData, 
      selectedLocale, 
      selectedTheme
    );

    // Injection du CSS inline
    const cssContent = fsSync.readFileSync(CONFIG.cssPath, 'utf8');
    
    // Ajouter le CSS PDF si activé
    let finalCss = cssContent;
    if (CONFIG.pagination.usePdfCss && fsSync.existsSync(CONFIG.cssPdfPath)) {
      const cssPdfContent = fsSync.readFileSync(CONFIG.cssPdfPath, 'utf8');
      finalCss += '\n\n' + cssPdfContent;
      console.log('✓ CSS PDF ajouté');
    }
    
    localizedHtml = localizedHtml.replace(
      /<link rel="stylesheet" href=".*?">/,
      `<style>${finalCss}</style>`
    );
    console.log('✓ HTML prêt');

    // Capture du screenshot
    const tempScreenshotPath = path.join(CONFIG.tempDir, 'full-screenshot.png');
    const { dimensions, safeCutPoints } = await captureScreenshot(
      localizedHtml, 
      tempScreenshotPath, 
      selectedTheme,
      CONFIG.pagination.usePdfCss
    );

    // Découpage en pages A4
    const slices = await sliceScreenshotIntoA4Pages(
      tempScreenshotPath, 
      dimensions,
      safeCutPoints
    );

    // Création du PDF final
    await createPdfFromSlices(slices, outputPath);

    // Nettoyage
    console.log('\n🧹 Nettoyage des fichiers temporaires...');
    await fs.unlink(tempScreenshotPath);
    console.log('✓ Nettoyage terminé');

    console.log('\n============================================================');
    console.log(`✅ PDF généré avec succès: ${outputPath}`);
    console.log(`   ${slices.length} page(s) A4`);
    console.log('============================================================\n');

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main();
}

module.exports = { captureScreenshot, sliceScreenshotIntoA4Pages, createPdfFromSlices };
