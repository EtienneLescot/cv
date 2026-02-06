/**
 * ============================================================================
 * CV PDF GENERATOR - SIMPLE & CLEAN
 * ============================================================================
 * 
 * Génération PDF simplifiée via Playwright :
 * - Utilise directement les fichiers HTML générés (index-fr.html, index-en.html)
 * - Applique le style PDF via style-pdf.css
 * - Export PDF natif sans traitement complexe
 * 
 * USAGE:
 *   node generate-pdf.js
 *   node generate-pdf.js --locale fr --theme dark
 *   node generate-pdf.js --all
 * 
 * OPTIONS:
 *   --locale [fr|en]     Langue du CV (défaut: fr)
 *   --theme [dark|light] Thème (défaut: dark)
 *   --all                Génère toutes les combinaisons
 * 
 * @requires @playwright/test
 */

const { chromium } = require('@playwright/test');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  htmlDir: process.env.HTML_DIR || './dist/web',
  outputDir: process.env.OUTPUT_DIR || './dist/pdf',
  
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light'],
  
  pdfOptions: {
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: false,
    margin: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm'
    }
  }
};

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Génère un PDF depuis un fichier HTML
 */
async function generatePdf(locale, theme, options = {}) {
  const htmlFile = `index-${locale}.html`;
  const htmlPath = path.resolve(CONFIG.htmlDir, htmlFile);
  const outputPath = path.join(CONFIG.outputDir, `cv-${locale}-${theme}.pdf`);
  
  // Vérifier que le fichier HTML existe
  if (!fsSync.existsSync(htmlPath)) {
    console.error(`❌ HTML file not found: ${htmlPath}`);
    console.error(`   HTML_DIR: ${CONFIG.htmlDir}`);
    console.error(`   Looking for: ${htmlFile}`);
    throw new Error(`HTML file not found: ${htmlPath}`);
  }
  
  console.log(`📄 Generating PDF: ${locale} / ${theme}`);
  console.log(`   Input: ${htmlFile}`);
  console.log(`   Output: ${outputPath}`);
  
  // Créer le dossier de sortie si nécessaire
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  
  // Lancer le navigateur
  const browser = await chromium.launch({
    headless: true
  });
  
  const page = await browser.newPage({
    viewport: {
      width: 1200,
      height: 3000
    },
    deviceScaleFactor: options.raster ? 2 : 1
  });
  
  // Charger le HTML
  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  
  // Lire les CSS nécessaires
  const cssBasePath = path.join(__dirname, 'style.css');
  const cssPdfPath = path.join(__dirname, 'style-pdf.css');
  const cssBaseContent = await fs.readFile(cssBasePath, 'utf-8');
  const cssPdfContent = await fs.readFile(cssPdfPath, 'utf-8');
  
  // Naviguer vers la page
  await page.goto(`file://${htmlPath}`, {
    waitUntil: 'networkidle'
  });

  // Forcer le rendu en mode "screen"
  await page.emulateMedia({ media: 'screen' });
  
  // Supprimer tous les liens CSS existants et injecter notre CSS directement
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach(link => link.remove());
  });
  
  // Injecter le CSS de base
  await page.addStyleTag({ content: cssBaseContent });
  
  // Injecter le CSS PDF
  await page.addStyleTag({ content: cssPdfContent });
  
  // Appliquer le thème et activer le mode PDF
  await page.evaluate((selectedTheme) => {
    document.documentElement.setAttribute('data-theme', selectedTheme);
    // pdf-mode injection removed: PDF debug class should be added explicitly when needed
  }, theme);
  
  // Attendre que tout soit rendu
  await page.waitForTimeout(1500);
  
  // Vérifier la hauteur du contenu
  const contentHeight = await page.evaluate(() => {
    return document.querySelector('.container')?.scrollHeight || document.body.scrollHeight;
  });
  console.log(`   Content height: ${contentHeight}px`);
  
  if (options.raster) {
    // Génération raster (capture fullPage + PDF) pour éviter tout découpage
    const pngBuffer = await page.screenshot({
      fullPage: true,
      type: 'png'
    });

    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const pngDims = pngImage.scale(1);
    const pdfPage = pdfDoc.addPage([pngDims.width, pngDims.height]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngDims.width,
      height: pngDims.height
    });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
  } else {
    // Génération vectorielle standard (multi-pages A4)
    await page.pdf({
      path: outputPath,
      ...CONFIG.pdfOptions
    });
  }
  
  await browser.close();
  
  console.log(`✅ PDF generated: ${outputPath}\n`);
}

/**
 * Génère toutes les combinaisons de PDFs
 */
async function generateAll(options = {}) {
  console.log('🚀 Generating all PDF combinations...\n');
  
  for (const locale of CONFIG.supportedLocales) {
    for (const theme of CONFIG.supportedThemes) {
      try {
        await generatePdf(locale, theme, options);
      } catch (error) {
        console.error(`❌ Error generating ${locale}/${theme}:`, error.message);
      }
    }
  }
  
  console.log('🎉 All PDFs generated!');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options = {
    locale: 'fr',
    theme: 'dark',
    all: false,
    raster: false
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) {
      options.locale = args[++i];
    } else if (args[i] === '--theme' && args[i + 1]) {
      options.theme = args[++i];
    } else if (args[i] === '--all') {
      options.all = true;
    } else if (args[i] === '--raster') {
      options.raster = true;
    } else if (args[i] === '--vector') {
      options.raster = false;
    }
  }
  
  // Validate options
  if (!CONFIG.supportedLocales.includes(options.locale)) {
    console.error(`❌ Invalid locale: ${options.locale}`);
    console.error(`   Supported: ${CONFIG.supportedLocales.join(', ')}`);
    process.exit(1);
  }
  
  if (!CONFIG.supportedThemes.includes(options.theme)) {
    console.error(`❌ Invalid theme: ${options.theme}`);
    console.error(`   Supported: ${CONFIG.supportedThemes.join(', ')}`);
    process.exit(1);
  }
  
  try {
    if (options.all) {
      await generateAll({ raster: options.raster });
    } else {
      await generatePdf(options.locale, options.theme, { raster: options.raster });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generatePdf, generateAll };
