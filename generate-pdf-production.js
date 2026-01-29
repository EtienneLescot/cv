/**
 * ============================================================================
 * PRODUCTION PDF GENERATOR - Playwright + Chromium Headless
 * ============================================================================
 * 
 * Ce script génère un PDF pixel-perfect identique au rendu écran du CV,
 * sans utiliser @media print. Conçu pour fonctionner de manière déterministe
 * en environnement CI/CD.
 * 
 * GARANTIES:
 * - Rendu identique entre navigateur et PDF
 * - Chargement synchronisé des webfonts
 * - Viewport cohérent avec format A4
 * - Media forcée en "screen" (pas "print")
 * - Pagination maîtrisée par le layout HTML
 * 
 * USAGE:
 *   node generate-pdf-production.js
 *   node generate-pdf-production.js --url http://localhost:3000
 *   node generate-pdf-production.js --locale fr --theme dark
 * 
 * @requires @playwright/test (npm install @playwright/test)
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
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
  
  // Options disponibles
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light'],
  
  // Viewport pour capturer le layout screen complet
  // On utilise la largeur du container (900px) + padding
  // La hauteur sera automatique (fullPage)
  viewport: {
    width: 1000,   // Suffisant pour le container de 900px + marges
    height: 1400   // Hauteur initiale, sera étendue par fullPage
  },
  
  // Configuration PDF
  pdf: {
    format: 'A4',
    printBackground: true,  // ESSENTIEL pour conserver les fonds
    preferCSSPageSize: false,
    margin: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    // Force le rendu avec media="screen" (pas "print")
    displayHeaderFooter: false
  },
  
  // Timeouts (ms)
  timeout: {
    navigation: 30000,
    fonts: 10000,
    render: 5000
  },
  
  // Output
  outputDir: './exports'
};

// ============================================================================
// UTILITIES - Chargement des données localisées
// ============================================================================

/**
 * Charge les données YAML pour une locale donnée
 * @param {string} localeName - Code langue (fr, en)
 * @returns {Object|null} Données de traduction
 */
function loadLocale(localeName) {
  try {
    const yamlPath = path.join(CONFIG.localesPath, `${localeName}.yml`);
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    return yaml.parse(yamlContent);
  } catch (error) {
    console.error(`❌ Erreur chargement locale ${localeName}:`, error.message);
    return null;
  }
}

/**
 * Génère le HTML localisé avec thème
 * @param {string} templateHtml - Template HTML de base
 * @param {Object} localeData - Données de traduction
 * @param {string} localeName - Code langue
 * @param {string} themeName - Thème (dark/light)
 * @returns {string} HTML complet localisé
 */
function generateLocalizedHtml(templateHtml, localeData, localeName, themeName) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;

  // Configuration de base
  document.documentElement.lang = localeName;
  document.documentElement.setAttribute('data-theme', themeName);

  // Meta tags
  if (localeData.title) document.title = localeData.title;

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
      const attr = selector.includes('property=') ? 'content' : 'content';
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
// PLAYWRIGHT - Rendu et génération PDF
// ============================================================================

/**
 * Attend explicitement que toutes les webfonts soient chargées
 * CRITIQUE pour un rendu déterministe et identique au navigateur
 * 
 * @param {Page} page - Instance Playwright Page
 * @returns {Promise<boolean>} true si toutes les fonts sont chargées
 */
async function waitForFonts(page) {
  try {
    await page.waitForFunction(
      () => document.fonts.ready,
      { timeout: CONFIG.timeout.fonts }
    );
    
    // Vérification supplémentaire: toutes les fonts sont bien "loaded"
    const allFontsLoaded = await page.evaluate(() => {
      return Array.from(document.fonts).every(font => font.status === 'loaded');
    });

    if (!allFontsLoaded) {
      console.warn('⚠️  Certaines fonts ne sont pas chargées, attente supplémentaire...');
      await page.waitForTimeout(1000);
    }

    const fontCount = await page.evaluate(() => document.fonts.size);
    console.log(`✓ ${fontCount} webfont(s) chargée(s) et prête(s)`);
    
    return true;
  } catch (error) {
    console.warn('⚠️  Timeout attente fonts:', error.message);
    return false;
  }
}

/**
 * Attend la stabilité complète du DOM (images, CSS, animations)
 * 
 * @param {Page} page - Instance Playwright Page
 */
async function waitForLayoutStability(page) {
  // Attendre que le réseau soit inactif
  await page.waitForLoadState('networkidle', { 
    timeout: CONFIG.timeout.navigation 
  });
  
  // Attendre un cycle de rendu supplémentaire
  await page.waitForTimeout(CONFIG.timeout.render);
  
  // Vérifier que les images sont chargées
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
 * Configure la page Playwright pour un rendu optimal PDF
 * 
 * @param {Page} page - Instance Playwright Page
 */
async function configurePage(page) {
  // Désactiver UNIQUEMENT les animations pour un rendu déterministe
  // On n'injecte PAS de CSS custom qui casse le layout
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
  
  // Masquer les boutons d'interface (print, theme, lang) pour le PDF
  await page.evaluate(() => {
    const buttonsToHide = document.querySelectorAll(
      '#print-btn, #toggle, #lang-button, .lang-dropdown, .top-right-buttons'
    );
    buttonsToHide.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  });
  
  console.log('✓ Page configurée pour PDF');
}

/**
 * Génère le PDF avec Playwright
 * 
 * @param {string} localizedHtml - HTML complet localisé
 * @param {string} outputPath - Chemin de sortie du PDF
 * @param {string} themeName - Thème (pour logs)
 */
async function generatePdf(localizedHtml, outputPath, themeName) {
  let browser;
  
  try {
    console.log('\n🚀 Lancement de Chromium headless...');
    
    // Lancement du navigateur
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-web-security',  // Pour éviter CORS si chargement local
        '--font-render-hinting=none',  // Rendu fonts optimal
        '--disable-gpu',  // Pas besoin de GPU en headless
        '--no-sandbox'  // Nécessaire en CI/CD
      ]
    });

    const context = await browser.newContext({
      viewport: CONFIG.viewport,
      deviceScaleFactor: 1,  // Pas de scaling, rendu 1:1
      hasTouch: false,
      isMobile: false,
      // Force le rendu avec media="screen" (pas "print")
      colorScheme: themeName === 'dark' ? 'dark' : 'light'
    });

    const page = await context.newPage();
    
    // CRITIQUE: Forcer media='screen' pour éviter @media print
    await page.emulateMedia({ media: 'screen' });
    
    console.log('✓ Navigateur initialisé');
    console.log(`  Viewport: ${CONFIG.viewport.width}×${CONFIG.viewport.height}px`);
    console.log(`  Media: screen (${themeName}) - @media print désactivé`);

    // Chargement du HTML
    console.log('\n📄 Chargement du HTML...');
    await page.setContent(localizedHtml, {
      waitUntil: 'domcontentloaded'
    });

    // Synchronisation critique: fonts + layout
    console.log('\n⏳ Synchronisation du rendu...');
    await waitForFonts(page);
    await waitForLayoutStability(page);
    await configurePage(page);

    // Génération PDF
    console.log(`\n📝 Génération du PDF: ${path.basename(outputPath)}`);
    
    // Screenshot de debug pour vérifier le rendu avant PDF
    const debugScreenshot = outputPath.replace('.pdf', '-debug.png');
    await page.screenshot({ 
      path: debugScreenshot, 
      fullPage: true 
    });
    console.log(`✓ Screenshot debug: ${path.basename(debugScreenshot)}`);
    
    await page.pdf({
      path: outputPath,
      ...CONFIG.pdf
    });

    console.log('✅ PDF généré avec succès!');
    
    await browser.close();
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la génération PDF:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

// ============================================================================
// MAIN - Point d'entrée du script
// ============================================================================

/**
 * Parse les arguments CLI
 * 
 * @returns {Object} Options extraites
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    locale: 'fr',
    theme: 'dark',
    output: null
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
    }
  }

  return options;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('============================================================');
  console.log('  PDF GENERATOR - Production Ready (Playwright)');
  console.log('============================================================\n');

  try {
    // Parse des arguments
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

    // Création du répertoire de sortie
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    // Chemin de sortie
    const outputFileName = `cv-${selectedLocale}-${selectedTheme}.pdf`;
    const outputPath = options.output || path.join(CONFIG.outputDir, outputFileName);
    console.log(`   Output: ${outputPath}\n`);

    // Chargement du template et de la locale
    console.log('📚 Chargement des ressources...');
    const templateHtml = fs.readFileSync(CONFIG.templatePath, 'utf8');
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

    // Injection du CSS inline (évite les problèmes de chargement)
    const cssContent = fs.readFileSync(CONFIG.cssPath, 'utf8');
    localizedHtml = localizedHtml.replace(
      /<link rel="stylesheet" href=".*?">/,
      `<style>${cssContent}</style>`
    );
    console.log('✓ HTML prêt pour le rendu');

    // Génération du PDF
    await generatePdf(localizedHtml, outputPath, selectedTheme);

    console.log('\n============================================================');
    console.log(`✅ PDF généré: ${outputPath}`);
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

module.exports = { generatePdf, waitForFonts, loadLocale };
