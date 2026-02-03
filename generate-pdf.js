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
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  htmlDir: __dirname,
  outputDir: './exports',
  
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light'],
  
  pdfOptions: {
    format: 'A4',
    printBackground: true,
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
async function generatePdf(locale, theme) {
  const htmlFile = `index-${locale}.html`;
  const htmlPath = path.join(CONFIG.htmlDir, htmlFile);
  const outputPath = path.join(CONFIG.outputDir, `cv-${locale}-${theme}.pdf`);
  
  // Vérifier que le fichier HTML existe
  if (!fsSync.existsSync(htmlPath)) {
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
  
  const page = await browser.newPage();
  
  // Charger le HTML avec baseURL pour que les CSS relatifs fonctionnent
  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  await page.goto(`file://${htmlPath}`, {
    waitUntil: 'networkidle'
  });
  
  // Appliquer le thème
  await page.evaluate((selectedTheme) => {
    document.documentElement.setAttribute('data-theme', selectedTheme);
    // Activer le mode PDF
    document.documentElement.classList.add('pdf-mode');
  }, theme);
  
  // Charger le CSS PDF
  const cssPdfPath = path.join(CONFIG.htmlDir, 'style-pdf.css');
  const cssPdfContent = await fs.readFile(cssPdfPath, 'utf-8');
  await page.addStyleTag({ content: cssPdfContent });
  
  // Attendre que tout soit rendu
  await page.waitForTimeout(500);
  
  // Générer le PDF
  await page.pdf({
    path: outputPath,
    ...CONFIG.pdfOptions
  });
  
  await browser.close();
  
  console.log(`✅ PDF generated: ${outputPath}\n`);
}

/**
 * Génère toutes les combinaisons de PDFs
 */
async function generateAll() {
  console.log('🚀 Generating all PDF combinations...\n');
  
  for (const locale of CONFIG.supportedLocales) {
    for (const theme of CONFIG.supportedThemes) {
      try {
        await generatePdf(locale, theme);
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
    all: false
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) {
      options.locale = args[++i];
    } else if (args[i] === '--theme' && args[i + 1]) {
      options.theme = args[++i];
    } else if (args[i] === '--all') {
      options.all = true;
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
      await generateAll();
    } else {
      await generatePdf(options.locale, options.theme);
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
