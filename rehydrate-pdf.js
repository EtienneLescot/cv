/**
 * ============================================================================
 * PDF REHYDRATION - Add Invisible Selectable Text to Raster PDF
 * ============================================================================
 * 
 * This script takes a raster PDF (screenshot-based) and "rehydrates" it
 * by adding invisible selectable text on top, making the PDF searchable
 * and copyable while maintaining the pixel-perfect visual appearance.
 * 
 * APPROACH:
 * 1. Use Playwright to extract text content and precise coordinates from HTML
 * 2. Use pdf-lib to overlay invisible text on the raster PDF
 * 3. Handle coordinate conversion (HTML top-left vs PDF bottom-left)
 * 4. Calculate scaling factor between HTML viewport and PDF dimensions
 * 
 * USAGE:
 *   node rehydrate-pdf.js
 *   node rehydrate-pdf.js --locale fr --theme dark
 *   node rehydrate-pdf.js --input exports/cv-fr-d.pdf
 * 
 * @requires @playwright/test pdf-lib
 */

const { chromium } = require('@playwright/test');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('yaml');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Source HTML (same as generateCvPdf.js)
  templatePath: path.join(__dirname, 'index-template.html'),
  localesPath: path.join(__dirname, 'locales'),
  cssPath: path.join(__dirname, 'style.css'),
  cssPdfPath: path.join(__dirname, 'style-pdf.css'),
  
  // Viewport (must match generateCvPdf.js)
  viewport: {
    width: 900,
    height: 1273
  },
  
  // A4 dimensions in pixels (96 DPI)
  a4: {
    widthPx: 794,
    heightPx: 1123
  },
  
  // Timeouts
  timeout: {
    navigation: 30000,
    fonts: 10000,
    render: 5000
  },
  
  // Output
  outputDir: './exports',
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light']
};

// ============================================================================
// UTILITIES - Locale Loading
// ============================================================================

function loadLocale(localeName) {
  try {
    const yamlPath = path.join(CONFIG.localesPath, `${localeName}.yml`);
    const yamlContent = fsSync.readFileSync(yamlPath, 'utf8');
    return yaml.parse(yamlContent);
  } catch (error) {
    console.error(`❌ Error loading locale ${localeName}:`, error.message);
    return null;
  }
}

function generateHtml(locale, theme) {
  try {
    const { JSDOM } = require('jsdom');
    
    const templateContent = fsSync.readFileSync(CONFIG.templatePath, 'utf8');
    const cssContent = fsSync.readFileSync(CONFIG.cssPath, 'utf8');
    const cssPdfContent = fsSync.readFileSync(CONFIG.cssPdfPath, 'utf8');
    const localeData = loadLocale(locale);
    
    if (!localeData) {
      throw new Error(`Failed to load locale data for ${locale}`);
    }
    
    // Parse HTML with JSDOM
    const dom = new JSDOM(templateContent);
    const { document } = dom.window;
    
    // Set document attributes
    document.documentElement.lang = locale;
    document.documentElement.setAttribute('data-theme', theme);
    
    // Set title
    if (localeData.title) {
      document.title = localeData.title;
    }
    
    // Update meta tags
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
    
    // Update ARIA labels
    const ariaElements = {
      'lang-button': localeData['lang-label'],
      'toggle': localeData['theme-label'],
      'print-btn': localeData['download-label']
    };
    
    Object.entries(ariaElements).forEach(([id, label]) => {
      const element = document.getElementById(id);
      if (element && label) {
        element.setAttribute('aria-label', label);
      }
    });
    
    // Replace all data-i18n elements with localized content
    const i18nElements = document.querySelectorAll('[data-i18n]');
    i18nElements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = localeData[key];
      if (translation !== undefined) {
        element.innerHTML = translation;
      }
    });
    
    // Serialize back to HTML string
    let html = dom.serialize();
    
    // Note: CSS is already linked in the template, but for inline generation:
    // We could inject styles, but the template already has <link rel="stylesheet">
    // For PDF generation context, we might want to inline styles:
    html = html.replace('</head>', `
      <style>${cssContent}</style>
      <style>${cssPdfContent}</style>
    </head>`);
    
    return html;
  } catch (error) {
    console.error('❌ Error generating HTML:', error.message);
    throw error;
  }
}

// ============================================================================
// TEXT EXTRACTION - Extract text with precise coordinates from HTML
// ============================================================================

/**
 * Extract all text nodes with their precise bounding boxes from the HTML page
 * Uses getClientRects() to handle multiline text correctly
 */
async function extractTextCoordinates(page) {
  console.log('📝 Extracting text coordinates from HTML...');
  
  const textData = await page.evaluate(() => {
    const results = [];
    
    // Helper function to traverse DOM and find text nodes
    function walkTextNodes(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text.length > 0) {
          // Create range for this text node
          const range = document.createRange();
          range.selectNodeContents(node);
          
          // Get all client rects (handles multiline text)
          const rects = range.getClientRects();
          
          // Get computed style from parent element
          const parent = node.parentElement;
          const style = parent ? window.getComputedStyle(parent) : null;
          const fontSize = style ? parseFloat(style.fontSize) : 16;
          const fontFamily = style ? style.fontFamily : 'Arial';
          const fontWeight = style ? style.fontWeight : 'normal';
          
          // If we have multiple rects, the text wraps across lines
          if (rects.length > 1) {
            // Process each rect separately
            for (let i = 0; i < rects.length; i++) {
              const rect = rects[i];
              
              // For wrapped text, we need to approximate which part of text is on which line
              // This is imperfect, but better than nothing
              const charsPerLine = Math.ceil(text.length / rects.length);
              const start = i * charsPerLine;
              const end = Math.min((i + 1) * charsPerLine, text.length);
              const lineText = text.substring(start, end).trim();
              
              if (lineText.length > 0 && rect.width > 0 && rect.height > 0) {
                results.push({
                  text: lineText,
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                  fontSize: fontSize,
                  fontFamily: fontFamily,
                  fontWeight: fontWeight
                });
              }
            }
          } else if (rects.length === 1) {
            // Single line text
            const rect = rects[0];
            if (rect.width > 0 && rect.height > 0) {
              results.push({
                text: text,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
                fontSize: fontSize,
                fontFamily: fontFamily,
                fontWeight: fontWeight
              });
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;
        
        // Skip script, style, noscript tags
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          return;
        }
        
        // Skip hidden elements
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return;
        }
        
        // Recurse into child nodes
        for (let child of element.childNodes) {
          walkTextNodes(child, depth + 1);
        }
      }
    }
    
    // Start from body
    const body = document.body;
    if (body) {
      walkTextNodes(body);
    }
    
    // Also get viewport dimensions
    return {
      textItems: results,
      viewport: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      }
    };
  });
  
  console.log(`✅ Extracted ${textData.textItems.length} text segments`);
  console.log(`📐 HTML viewport: ${textData.viewport.width}x${textData.viewport.height}px`);
  
  return textData;
}

// ============================================================================
// PDF OVERLAY - Add invisible text to raster PDF
// ============================================================================

/**
 * Load the raster PDF and overlay invisible text on it
 */
async function overlayTextOnPdf(pdfPath, textData, outputPath, debugMode = false) {
  console.log(`📄 Loading raster PDF: ${pdfPath}`);
  
  // Load the existing raster PDF
  const existingPdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  
  // Load standard font (pdf-lib limitation: can't embed custom fonts easily)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Get pages
  const pages = pdfDoc.getPages();
  
  console.log(`📑 PDF has ${pages.length} pages`);
  
  // Calculate scaling factors
  const firstPage = pages[0];
  const pdfWidth = firstPage.getWidth();
  const pdfHeight = firstPage.getHeight();
  const htmlWidth = textData.viewport.width;
  const htmlHeight = textData.viewport.height;
  
  // Calculate total HTML height for all pages
  const totalHtmlHeight = htmlHeight;
  const numPages = pages.length;
  
  // Use same window height calculation as generateCvPdf.js
  // windowHeight = windowWidth * 1.414 (A4 ratio)
  const windowHeight = Math.round(CONFIG.viewport.width * 1.414);
  
  console.log(`📐 Window height (A4 ratio): ${windowHeight}px`);
  
  // Scale factors: PDF points to HTML pixels
  const scaleX = pdfWidth / CONFIG.viewport.width;
  const scaleY = pdfHeight / windowHeight;
  
  console.log(`📐 PDF dimensions: ${pdfWidth}x${pdfHeight}pt (${numPages} pages)`);
  console.log(`📐 HTML dimensions: ${htmlWidth}x${htmlHeight}px`);
  console.log(`📐 Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);
  
  // Process each text item
  let itemsProcessed = 0;
  let itemsSkipped = 0;
  
  for (const item of textData.textItems) {
    // Determine which page this text belongs to based on windowHeight
    const pageIndex = Math.floor(item.y / windowHeight);
    
    if (pageIndex >= pages.length) {
      // Text is beyond available pages, skip
      itemsSkipped++;
      continue;
    }
    
    const page = pages[pageIndex];
    const pageHeight = page.getHeight();
    
    // Calculate Y position relative to current page
    const relativeY = item.y - (pageIndex * windowHeight);
    
    // Convert coordinates from HTML (top-left origin) to PDF (bottom-left origin)
    // PDF Y starts from bottom, HTML Y starts from top
    const pdfX = item.x * scaleX;
    const pdfY = pageHeight - (relativeY * scaleY) - (item.fontSize * scaleY);
    const pdfFontSize = item.fontSize * scaleY;
    
    // Draw invisible text (opacity = 0)
    try {
      // Clean text to avoid encoding issues with WinAnsi
      // Replace problematic Unicode characters
      const cleanText = item.text
        .replace(/→/g, '->')      // Arrow
        .replace(/‑/g, '-')        // Non-breaking hyphen
        .replace(/–/g, '-')        // En dash
        .replace(/—/g, '--')       // Em dash
        .replace(/'/g, "'")        // Smart single quote
        .replace(/'/g, "'")        // Smart single quote
        .replace(/"/g, '"')        // Smart double quote
        .replace(/"/g, '"')        // Smart double quote
        .replace(/…/g, '...')      // Ellipsis
        .replace(/[\u0080-\u00FF]/g, (c) => {  // Try to preserve Latin-1 chars
          return c;
        })
        .replace(/[^\x00-\xFF]/g, '?');  // Replace other non-Latin1 with ?
      
      page.drawText(cleanText, {
        x: pdfX,
        y: pdfY,
        size: pdfFontSize,
        font: font,
        color: debugMode ? rgb(1, 0, 0) : rgb(0, 0, 0),  // Red in debug mode
        opacity: debugMode ? 0.5 : 0  // Semi-transparent in debug, invisible otherwise
      });
      
      itemsProcessed++;
    } catch (error) {
      // Skip items that cause errors (e.g., text too long, invalid coordinates)
      console.warn(`⚠️  Skipped text item: "${item.text.substring(0, 20)}..." (${error.message})`);
    }
  }
  
  console.log(`✅ Overlaid ${itemsProcessed}/${textData.textItems.length} text items (${itemsSkipped} skipped - out of bounds)`);
  
  // Save the rehydrated PDF
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  
  console.log(`💾 Saved rehydrated PDF: ${outputPath}`);
  
  return outputPath;
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

async function rehydratePdf(options = {}) {
  const locale = options.locale || 'fr';
  const theme = options.theme || 'dark';
  const inputPdf = options.input || null;
  const debugMode = options.debug || false;
  
  console.log('\n' + '='.repeat(80));
  console.log('🔄 PDF REHYDRATION - Adding Invisible Selectable Text');
  console.log('='.repeat(80));
  console.log(`📍 Locale: ${locale} | Theme: ${theme}`);
  console.log('');
  
  let browser;
  
  try {
    // Step 1: Generate HTML content
    console.log('📝 Step 1: Generating HTML content...');
    const html = generateHtml(locale, theme);
    
    // Step 2: Launch browser and extract text coordinates
    console.log('🌐 Step 2: Launching browser...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: {
        width: CONFIG.viewport.width,
        height: CONFIG.viewport.height
      }
    });
    
    // Set content and wait for fonts
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.timeout.navigation 
    });
    
    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(CONFIG.timeout.render);
    
    // Prepare page like in generateCvPdf.js: add pdf-mode class and hide UI buttons
    await page.evaluate(() => {
      // Add pdf-mode class
      document.documentElement.classList.add('pdf-mode');
      
      // Hide UI buttons
      const buttonsToHide = document.querySelectorAll(
        '#print-btn, #toggle, #lang-button, .lang-dropdown, .top-right-buttons'
      );
      buttonsToHide.forEach(btn => {
        if (btn) btn.style.display = 'none';
      });
    });
    
    // Wait a bit more for layout adjustments
    await page.waitForTimeout(500);
    
    console.log('✅ Page prepared (pdf-mode activated, UI buttons hidden)');
    
    // Debug: Check if locales are loaded
    const hasLocaleData = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-i18n]');
      console.log(`Found ${elements.length} elements with data-i18n`);
      
      // Check if first element has content
      if (elements.length > 0) {
        console.log(`First element text: "${elements[0].textContent}"`);
      }
      
      return elements.length;
    });
    
    console.log(`🔍 Found ${hasLocaleData} elements with data-i18n attribute`);
    
    // Extract text coordinates
    const textData = await extractTextCoordinates(page);
    
    // Close browser
    await browser.close();
    browser = null;
    
    // Step 3: Determine input PDF path
    let pdfPath;
    if (inputPdf) {
      pdfPath = inputPdf;
    } else {
      // Build default PDF path based on locale and theme
      const themeCode = theme === 'dark' ? 'd' : 'light';
      const filename = `cv-${locale}-${themeCode}.pdf`;
      pdfPath = path.join(CONFIG.outputDir, filename);
    }
    
    // Check if PDF exists
    if (!fsSync.existsSync(pdfPath)) {
      throw new Error(`Input PDF not found: ${pdfPath}`);
    }
    
    // Step 4: Generate output path
    const pdfBasename = path.basename(pdfPath, '.pdf');
    const outputPath = path.join(CONFIG.outputDir, `${pdfBasename}-final.pdf`);
    
    // Step 5: Overlay text on PDF
    console.log('📄 Step 3: Overlaying invisible text on PDF...');
    if (debugMode) {
      console.log('🐛 DEBUG MODE: Text will be visible in RED');
    }
    await overlayTextOnPdf(pdfPath, textData, outputPath, debugMode);
    
    // Success!
    console.log('\n' + '='.repeat(80));
    console.log('✅ PDF REHYDRATION COMPLETE!');
    console.log('='.repeat(80));
    console.log(`📂 Input:  ${pdfPath}`);
    console.log(`📂 Output: ${outputPath}`);
    console.log('');
    
    return outputPath;
    
  } catch (error) {
    console.error('\n❌ Error during PDF rehydration:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    locale: 'fr',
    theme: 'dark',
    input: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--locale' && i + 1 < args.length) {
      options.locale = args[++i];
    } else if (arg === '--theme' && i + 1 < args.length) {
      options.theme = args[++i];
    } else if (arg === '--input' && i + 1 < args.length) {
      options.input = args[++i];
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--help') {
      console.log(`
Usage: node rehydrate-pdf.js [options]

Options:
  --locale <fr|en>      Locale to use (default: fr)
  --theme <dark|light>  Theme to use (default: dark)
  --input <path>        Path to input raster PDF (optional)
  --debug               Show text overlay in red (for debugging alignment)
  --help                Show this help message

Examples:
  node rehydrate-pdf.js
  node rehydrate-pdf.js --locale en --theme light
  node rehydrate-pdf.js --input exports/cv-fr-d.pdf
  node rehydrate-pdf.js --debug
      `);
      process.exit(0);
    }
  }
  
  // Validate options
  if (!CONFIG.supportedLocales.includes(options.locale)) {
    console.error(`❌ Invalid locale: ${options.locale}`);
    console.error(`   Supported locales: ${CONFIG.supportedLocales.join(', ')}`);
    process.exit(1);
  }
  
  if (!CONFIG.supportedThemes.includes(options.theme)) {
    console.error(`❌ Invalid theme: ${options.theme}`);
    console.error(`   Supported themes: ${CONFIG.supportedThemes.join(', ')}`);
    process.exit(1);
  }
  
  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  
  rehydratePdf(options)
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { rehydratePdf, extractTextCoordinates, overlayTextOnPdf };
