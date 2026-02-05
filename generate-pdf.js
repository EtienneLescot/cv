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
 *   node generate-pdf.js --pdf-css base
 *   node generate-pdf.js --pdf-css ats-clean
 * 
 * OPTIONS:
 *   --locale [fr|en]     Langue du CV (défaut: fr)
 *   --theme [dark|light] Thème (défaut: dark)
 *   --all                Génère toutes les combinaisons
 *   --pdf-css [base|pdf|ats-clean|ats-clean-no-negative|ats-uniform]
 *                         Choix CSS PDF (défaut: pdf)
 *   --tagged              Génère un PDF taggé (CDP Page.printToPDF)
 *   --simplify-structure  Simplifie le DOM (PDF) pour limiter les runs de texte
 *   --plain-text          Remplace le DOM par une version texte linéaire (ATS)
 *   --pdf-template        Utilise le template PDF ATS généré (index-<locale>-pdf.html)
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
  const htmlFile = options.pdfTemplate ? `index-${locale}-pdf.html` : `index-${locale}.html`;
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
  const cssAtsPath = path.join(__dirname, 'style-pdf-ats.css');
  const cssBaseContent = await fs.readFile(cssBasePath, 'utf-8');
  const cssPdfContent = await fs.readFile(cssPdfPath, 'utf-8');
  const cssAtsContent = fsSync.existsSync(cssAtsPath)
    ? await fs.readFile(cssAtsPath, 'utf-8')
    : '';
  
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
  
  // Injecter le CSS de base (sauf template PDF ATS)
  if (!options.pdfTemplate) {
    await page.addStyleTag({ content: cssBaseContent });
  }

  const pdfCssMode = options.pdfCss || 'pdf';

  if (options.pdfTemplate && cssAtsContent) {
    await page.addStyleTag({ content: cssAtsContent });
  } else if (pdfCssMode !== 'base') {
    // Injecter le CSS PDF
    await page.addStyleTag({ content: cssPdfContent });
  }

  // Overrides ATS-safe pour tester l'ordre de lecture
  if (pdfCssMode === 'ats-clean' || pdfCssMode === 'ats-clean-no-negative' || pdfCssMode === 'ats-uniform') {
    const atsOverride = `
      html.pdf-mode .section li::before,
      html.pdf-mode .sub-header .sector::before,
      html.pdf-mode .sub-header .stack::before,
      html.pdf-mode .sub-header a::before,
      html.pdf-mode h2::before {
        content: "" !important;
        display: none !important;
      }

      html.pdf-mode .section ul {
        list-style-type: disc !important;
        padding-left: 1.2rem !important;
      }

      html.pdf-mode .section li {
        padding-left: 0 !important;
      }
    `;

    await page.addStyleTag({ content: atsOverride });
  }

  if (pdfCssMode === 'ats-uniform') {
    const uniformTypography = `
      html.pdf-mode * {
        font-weight: 400 !important;
        font-style: normal !important;
        font-variation-settings: normal !important;
      }

      html.pdf-mode strong,
      html.pdf-mode b {
        font-weight: 400 !important;
      }
    `;

    await page.addStyleTag({ content: uniformTypography });
  }

  if (pdfCssMode === 'ats-clean-no-negative') {
    const noNegativeMargins = `
      html.pdf-mode .experiences-section .section,
      html.pdf-mode .experiences-section .neonbox {
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
    `;

    await page.addStyleTag({ content: noNegativeMargins });
  }
  
  // Appliquer le thème et activer le mode PDF
  if (!options.pdfTemplate) {
    await page.evaluate((selectedTheme) => {
      document.documentElement.setAttribute('data-theme', selectedTheme);
      document.documentElement.classList.add('pdf-mode');
    }, theme);
  }

  if (options.simplifyStructure) {
    // Simplifier le DOM pour réduire les runs de texte (meilleur ordre de sélection)
    await page.evaluate(() => {
      const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

      // Flatten sub-headers into a single text node
      document.querySelectorAll('.sub-header').forEach((header) => {
        const text = normalizeText(header.innerText || header.textContent || '');
        const p = document.createElement('p');
        p.className = 'sub-header-text';
        p.textContent = text;
        header.replaceWith(p);
      });

      // Flatten list items to remove inline tags (strong/a/br) into plain text
      document.querySelectorAll('.section li').forEach((li) => {
        const text = normalizeText(li.innerText || li.textContent || '');
        if (text.length > 0) {
          li.textContent = text;
        }
      });
    });
  }

  if (options.plainText) {
    await page.evaluate(() => {
      const blockTags = new Set([
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'DIV', 'HEADER'
      ]);

      const isHidden = (el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
      };

      const hasBlockDescendant = (el) => {
        for (const child of Array.from(el.children)) {
          if (blockTags.has(child.tagName)) return true;
          if (hasBlockDescendant(child)) return true;
        }
        return false;
      };

      const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

      const container = document.querySelector('main.container') || document.body;
      const lines = [];

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
          if (isHidden(node)) return NodeFilter.FILTER_SKIP;
          if (!blockTags.has(node.tagName)) return NodeFilter.FILTER_SKIP;
          if (node.tagName === 'UL' || node.tagName === 'OL') return NodeFilter.FILTER_SKIP;
          if (hasBlockDescendant(node)) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      while (walker.nextNode()) {
        const el = walker.currentNode;
        const text = normalizeText(el.innerText || el.textContent || '');
        if (text.length > 0) {
          lines.push(text);
        }
      }

      document.documentElement.classList.remove('pdf-mode');
      document.documentElement.setAttribute('data-theme', 'light');

      const style = document.createElement('style');
      style.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .plain-text {
          padding: 24px !important;
        }
        .plain-text pre {
          white-space: pre-wrap !important;
          font-size: 12pt !important;
          line-height: 1.4 !important;
          margin: 0 !important;
        }
      `;
      document.head.appendChild(style);

      const main = document.createElement('main');
      main.className = 'plain-text';

      const pre = document.createElement('pre');
      pre.textContent = lines.join('\n');

      main.appendChild(pre);
      document.body.innerHTML = '';
      document.body.appendChild(main);
    });
  }
  
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
  } else if (options.tagged) {
    // Génération vectorielle taggée (CDP Page.printToPDF)
    const client = await page.context().newCDPSession(page);
    const pdfResult = await client.send('Page.printToPDF', {
      ...CONFIG.pdfOptions,
      printBackground: true,
      generateTaggedPDF: true
    });
    const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
    await fs.writeFile(outputPath, pdfBuffer);
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
    raster: false,
    pdfCss: 'pdf',
    tagged: false,
    simplifyStructure: false,
    plainText: false,
    pdfTemplate: false
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
    } else if (args[i] === '--pdf-css' && args[i + 1]) {
      options.pdfCss = args[++i];
    } else if (args[i] === '--tagged') {
      options.tagged = true;
    } else if (args[i] === '--simplify-structure') {
      options.simplifyStructure = true;
    } else if (args[i] === '--plain-text') {
      options.plainText = true;
    } else if (args[i] === '--pdf-template') {
      options.pdfTemplate = true;
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
      await generateAll({
        raster: options.raster,
        pdfCss: options.pdfCss,
        tagged: options.tagged,
        simplifyStructure: options.simplifyStructure,
        plainText: options.plainText,
        pdfTemplate: options.pdfTemplate
      });
    } else {
      await generatePdf(options.locale, options.theme, {
        raster: options.raster,
        pdfCss: options.pdfCss,
        tagged: options.tagged,
        simplifyStructure: options.simplifyStructure,
        plainText: options.plainText,
        pdfTemplate: options.pdfTemplate
      });
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
