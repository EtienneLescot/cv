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
  // Largeur généreuse pour bon rendu, sera redimensionné à A4
  viewport: {
    width: 900,   // Largeur confortable
    height: 1273  // Ratio A4 (900 * 1.414)
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
 * La coupure se fait au MILIEU de l'espace entre deux sections
 */
async function findSafeCutPoints(page) {
  return await page.evaluate((config) => {
    const cutPoints = [0];  // Début du document
    
    // Trouver tous les éléments qui correspondent aux sélecteurs
    const elements = [];
    config.pagination.breakSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => elements.push({
        element: el,
        selector: selector
      }));
    });
    
    // Trier les éléments par position Y
    const sortedElements = elements
      .map(({ element, selector }) => {
        const rect = element.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const absoluteY = rect.top + scrollY;
        const style = window.getComputedStyle(element);
        const marginTop = parseInt(style.marginTop) || 0;
        
        return {
          element,
          selector,
          y: absoluteY,
          marginTop: marginTop,
          height: rect.height
        };
      })
      .filter(item => item.height >= config.pagination.minSectionHeight)
      .sort((a, b) => a.y - b.y);
    
    // Pour chaque élément (sauf le premier), calculer le milieu de l'espace avec l'élément précédent
    for (let i = 1; i < sortedElements.length; i++) {
      const prevElement = sortedElements[i - 1];
      const currentElement = sortedElements[i];
      
      // Position de fin de l'élément précédent
      const prevEnd = prevElement.y + prevElement.height;
      
      // Position de début de l'élément actuel (incluant son margin-top)
      const currentStart = currentElement.y;
      
      // Couper au milieu de l'espace entre les deux
      const middlePoint = Math.round((prevEnd + currentStart) / 2);
      
      cutPoints.push(middlePoint);
    }
    
    // Trier et dédupliquer
    return [...new Set(cutPoints)].sort((a, b) => a - b);
  }, CONFIG);
}

/**
 * Capture un screenshot complet de la page en mode screen
 */
/**
 * Capture des pages avec fenêtre virtuelle A4 scrollante
 * Concept : Une fenêtre de ratio A4 "glisse" le long de la page en scrollant
 */
async function captureWithVirtualA4Window(localizedHtml, outputDir, themeName, usePdfMode = true) {
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
    console.log(`  Viewport: ${CONFIG.viewport.width}×${CONFIG.viewport.height}px`);
    console.log(`  Fenêtre virtuelle A4: ${CONFIG.a4.widthPx}×${CONFIG.a4.heightPx}px (ratio 1:1.414)`);
    console.log(`  Media: screen (${themeName}) - @media print désactivé`);

    console.log('\n📄 Chargement du HTML...');
    await page.setContent(localizedHtml, {
      waitUntil: 'domcontentloaded'
    });

    console.log('\n⏳ Synchronisation du rendu...');
    await waitForFonts(page);
    await waitForLayoutStability(page);
    await preparePage(page, usePdfMode);

    // Obtenir la hauteur totale (incluant la marge de sécurité)
    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`  Hauteur totale du contenu: ${totalHeight}px (incluant marge de sécurité)`);

    // Calculer la hauteur de la fenêtre virtuelle A4 (ratio fixe)
    const windowWidth = CONFIG.viewport.width;
    const windowHeight = Math.round(windowWidth * 1.414);  // Ratio A4 exact
    
    console.log(`  Fenêtre virtuelle A4: ${windowWidth}×${windowHeight}px`);

    // Analyser les sections pour ajuster les positions de scroll
    let scrollPositions = [0];
    if (CONFIG.pagination.smartBreak) {
      console.log('\n🔍 Analyse des sections pour ajustement du scroll...');
      const safeCutPoints = await findSafeCutPoints(page);
      console.log(`✓ ${safeCutPoints.length} point(s) de coupure détecté(s): ${safeCutPoints.join(', ')}`);
      
      // Calculer les positions de scroll optimales
      scrollPositions = findOptimalCutPositions(safeCutPoints, totalHeight, windowHeight);
      console.log(`  Positions de scroll finales: ${scrollPositions.join(', ')}`);
    } else {
      // Scroll régulier tous les windowHeight px
      const numPages = Math.ceil(totalHeight / windowHeight);
      scrollPositions = Array.from({ length: numPages }, (_, i) => i * windowHeight);
    }

    // Capturer chaque page avec la fenêtre virtuelle A4 (HAUTEUR FIXE)
    console.log(`\n📸 Capture avec fenêtre A4 fixe (${scrollPositions.length} pages)...`);
    const screenshots = [];
    
    for (let i = 0; i < scrollPositions.length; i++) {
      const scrollY = scrollPositions[i];
      
      // Vérifier qu'on peut capturer une fenêtre complète
      if (scrollY + windowHeight > totalHeight + 100) {
        console.log(`  Page ${i + 1}: Ignorée (dépasse le contenu: Y=${scrollY})`);
        break;
      }
      
      console.log(`  Page ${i + 1}: Scroll à Y=${scrollY}px, capture ${windowHeight}px (fenêtre fixe)`);
      
      // Scroller à la position
      await page.evaluate((y) => {
        window.scrollTo(0, y);
      }, scrollY);
      
      // Attendre stabilisation
      await page.waitForTimeout(200);
      
      const screenshotPath = path.join(outputDir, `page-${i + 1}.png`);
      
      // Capturer TOUJOURS la même hauteur (fenêtre fixe)
      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        clip: {
          x: 0,
          y: 0,  // Relatif au viewport après scroll
          width: windowWidth,
          height: windowHeight
        }
      });
      
      screenshots.push({
        path: screenshotPath,
        width: windowWidth,
        height: windowHeight  // TOUJOURS la même hauteur
      });
    }
    
    console.log(`✓ ${screenshots.length} zone(s) capturée(s)`);
    
    await browser.close();
    
    return screenshots;
    
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
 * Convertit les screenshots en format A4
 * Redimensionne à la largeur A4 en préservant le ratio
 */
async function convertToA4Format(screenshots) {
  console.log('\n🔄 Conversion en format A4...');
  
  const a4Pages = [];
  
  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    console.log(`  Page ${i + 1}: ${screenshot.width}×${screenshot.height}px`);
    
    const image = sharp(screenshot.path);
    
    // Redimensionner à la largeur A4
    const scaleRatio = CONFIG.a4.widthPx / screenshot.width;
    const scaledHeight = Math.round(screenshot.height * scaleRatio);
    
    console.log(`    → Redimensionnement: ${CONFIG.a4.widthPx}×${scaledHeight}px (ratio: ${scaleRatio.toFixed(3)})`);
    
    const resized = await image
      .resize(CONFIG.a4.widthPx, scaledHeight, {
        fit: 'fill',
        kernel: 'lanczos3'
      })
      .png()
      .toBuffer();
    
    a4Pages.push(resized);
  }
  
  console.log(`✓ ${a4Pages.length} page(s) convertie(s)`);
  return a4Pages;
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
 * Crée un PDF multi-pages à partir des images A4
 */
async function createPdfFromA4Images(imageBuffers, outputPath) {
  console.log('\n📝 Création du PDF final...');
  
  const pdfDoc = await PDFDocument.create();
  
  // Dimensions A4 en points (1 point = 1/72 inch)
  // A4 = 210mm × 297mm = 595.28pt × 841.89pt
  const a4Width = 595.28;
  const a4Height = 841.89;
  
  for (let i = 0; i < imageBuffers.length; i++) {
    console.log(`  Ajout de la page ${i + 1}/${imageBuffers.length}...`);
    
    // Obtenir les dimensions de l'image
    const metadata = await sharp(imageBuffers[i]).metadata();
    
    // Créer une nouvelle page A4
    const page = pdfDoc.addPage([a4Width, a4Height]);
    
    // Embed l'image PNG dans le PDF
    const pngImage = await pdfDoc.embedPng(imageBuffers[i]);
    
    // Calculer les ratios
    const imgRatio = metadata.width / metadata.height;
    const a4Ratio = a4Width / a4Height;
    const ratioDiff = Math.abs(imgRatio - a4Ratio) / a4Ratio;
    
    // Sécurité: n'étirer que si la différence de ratio est très faible (<1%)
    if (ratioDiff < 0.01) {
      // Ratios quasi-identiques: étirer pour éviter la ligne blanche due à l'arrondi
      console.log(`    ✓ Ratio OK (diff: ${(ratioDiff * 100).toFixed(2)}%) - étirement autorisé`);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: a4Width,
        height: a4Height
      });
    } else {
      // Ratios trop différents: préserver le ratio et centrer (sécurité)
      console.warn(`    ⚠ Ratio différent (diff: ${(ratioDiff * 100).toFixed(2)}%) - préservation du ratio`);
      let drawWidth = a4Width;
      let drawHeight = drawWidth / imgRatio;
      
      if (drawHeight > a4Height) {
        drawHeight = a4Height;
        drawWidth = drawHeight * imgRatio;
      }
      
      const x = (a4Width - drawWidth) / 2;
      const y = (a4Height - drawHeight) / 2;
      
      page.drawImage(pngImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });
    }
  }
  
  console.log('  Écriture du fichier PDF...');
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  
  console.log(`✓ PDF créé: ${imageBuffers.length} page(s)`);
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

    // Capture avec fenêtre virtuelle A4 scrollante
    const screenshots = await captureWithVirtualA4Window(
      localizedHtml, 
      CONFIG.tempDir,
      selectedTheme,
      CONFIG.pagination.usePdfCss
    );

    // Conversion en format A4
    const a4Pages = await convertToA4Format(screenshots);

    // Création du PDF final
    await createPdfFromA4Images(a4Pages, outputPath);

    // Nettoyage
    console.log('\n🧹 Nettoyage des fichiers temporaires...');
    for (const screenshot of screenshots) {
      await fs.unlink(screenshot.path);
    }
    console.log('✓ Nettoyage terminé');

    console.log('\n============================================================');
    console.log(`✅ PDF généré avec succès: ${outputPath}`);
    console.log(`   ${a4Pages.length} page(s) A4`);
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

module.exports = { captureWithVirtualA4Window, convertToA4Format, createPdfFromA4Images };
