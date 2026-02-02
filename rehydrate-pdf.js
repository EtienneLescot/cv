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
const fontkit = require('@pdf-lib/fontkit');
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
  supportedThemes: ['dark', 'light'],
  
  // Fine-tuning options
  positioning: {
    // Mode: 'auto' uses bounding box dimensions directly, 'manual' uses calculated baseline
    mode: 'auto',  // 'auto' or 'manual'
    
    // Font size adjustment strategy
    adjustFontSizeToWidth: true,  // Dynamically adjust fontSize to match exact text width
    
    // Baseline positioning strategy (only used in manual mode):
    // 'top': Use rect.top + fontSize (current behavior)
    // 'baseline': Use estimated baseline position
    // 'bottom': Use rect.bottom
    strategy: 'baseline',
    
    // Manual offset adjustments (in pixels before scaling)
    offsetY: 0,  // Global offset: Positive = move text down, Negative = move text up
    offsetX: 0,  // Global offset: Positive = move text right, Negative = move text left
    
    // Specific offsets by element type (added to global offset)
    offsetsByType: {
      h1: 0,
      h2: 0,
      h3: 0,
      h4: 0,
      h5: 0,
      h6: 0,
      body: 0
    },
    
    // Font size adjustment factors (multiplicative)
    fontSizeAdjust: 1.0,           // Global adjustment
    
    // Specific adjustments by element type
    fontSizeAdjustments: {
      h1: 1.20,      // Large main title
      h2: 1.15,      // Section titles
      h3: 1.10,      // Sub-section titles
      h4: 1.05,      // Small titles
      h5: 1.02,      // Very small titles
      h6: 1.00,      // Smallest titles
      body: 0.95     // Regular body text
    },
    
    // Baseline offset as percentage of fontSize (0.0 to 1.0)
    // For Inter font: 0.203 (20.3% descent)
    baselineOffset: 0.203
  },
  
  // Font configuration
  fonts: {
    // Try to use embedded custom fonts for better accuracy
    useCustomFonts: true,  // Set to true if you have Inter.ttf in fonts/ folder
    
    // Local font paths (if available)
    fontPaths: {
      'Inter-Regular': './fonts/Inter-Regular.ttf',
      'Inter-Bold': './fonts/Inter-Bold.ttf'
    },
    
    // Standard PDF fonts to use (closest to Inter)
    // Helvetica is the closest sans-serif font to Inter in PDF standard fonts
    standardFonts: {
      regular: StandardFonts.Helvetica,
      bold: StandardFonts.HelveticaBold
    }
  }
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
// FONT HANDLING - Download and embed custom fonts
// ============================================================================

/**
 * Download a font from URL (with caching)
 */
async function loadFontFromFile(fontPath) {
  try {
    const fontBytes = await fs.readFile(fontPath);
    return fontBytes;
  } catch (error) {
    console.warn(`  ⚠️  Could not load font from ${fontPath}: ${error.message}`);
    return null;
  }
}

/**
 * Load and embed fonts into PDF document
 * Returns an object with font references: { regular, bold }
 */
async function loadFonts(pdfDoc) {
  const fonts = { regular: null, bold: null };
  
  if (!CONFIG.fonts.useCustomFonts) {
    // Use standard fonts
    fonts.regular = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.regular);
    fonts.bold = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.bold);
    console.log('✅ Using standard PDF fonts (Helvetica - closest to Inter)');
    return fonts;
  }
  
  try {
    console.log('🔍 Loading custom fonts from files...');
    
    // Try to load Inter Regular
    if (CONFIG.fonts.fontPaths['Inter-Regular']) {
      const regularBuffer = await loadFontFromFile(CONFIG.fonts.fontPaths['Inter-Regular']);
      if (regularBuffer) {
        fonts.regular = await pdfDoc.embedFont(regularBuffer);
        console.log('  ✅ Inter Regular loaded from file');
      }
    }
    
    // Try to load Inter Bold
    if (CONFIG.fonts.fontPaths['Inter-Bold']) {
      const boldBuffer = await loadFontFromFile(CONFIG.fonts.fontPaths['Inter-Bold']);
      if (boldBuffer) {
        fonts.bold = await pdfDoc.embedFont(boldBuffer);
        console.log('  ✅ Inter Bold loaded from file');
      }
    }
    
    // Fallback if any font is missing
    if (!fonts.regular) {
      fonts.regular = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.regular);
      console.log('  ⚠️  Using Helvetica as fallback for regular font');
    }
    if (!fonts.bold) {
      fonts.bold = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.bold);
      console.log('  ⚠️  Using Helvetica-Bold as fallback for bold font');
    }
    
  } catch (error) {
    console.warn(`⚠️  Error loading custom fonts: ${error.message}`);
    console.log('  Using fallback fonts...');
    fonts.regular = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.regular);
    fonts.bold = await pdfDoc.embedFont(CONFIG.fonts.standardFonts.bold);
  }
  
  return fonts;
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
          
          // Get computed style for font size and metrics
          const parent = node.parentElement;
          const style = parent ? window.getComputedStyle(parent) : null;
          const fontSize = style ? parseFloat(style.fontSize) : 16;
          const fontFamily = style ? style.fontFamily : 'Arial';
          const fontWeight = style ? style.fontWeight : 'normal';
          const lineHeight = style ? style.lineHeight : 'normal';
          const textTransform = style ? style.textTransform : 'none';
          const letterSpacing = style ? parseFloat(style.letterSpacing) || 0 : 0;
          
          // Detect element type (for font size adjustments)
          let elementType = 'body';
          let tagName = parent ? parent.tagName.toLowerCase() : '';
          
          // Walk up the DOM to find if we're in a heading
          let current = parent;
          while (current && elementType === 'body') {
            const tag = current.tagName ? current.tagName.toLowerCase() : '';
            if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
              elementType = 'heading';
              tagName = tag;
              break;
            }
            current = current.parentElement;
          }
          
          // Calculate baseline offset
          // For Inter font: descent is ~20% of fontSize, ascent is ~75%
          const estimatedDescent = fontSize * 0.203;  // Inter specific
          const estimatedAscent = fontSize * 0.75;     // Inter specific
          
          // If we have multiple rects, the text wraps across lines
          if (rects.length > 1) {
            // Extract text character by character to find exact line breaks
            let charIndex = 0;
            
            for (let i = 0; i < rects.length; i++) {
              const rect = rects[i];
              
              if (rect.width === 0 || rect.height === 0) continue;
              
              // Find where this line starts and ends by checking Y position of each character
              let lineStart = charIndex;
              let lineEnd = charIndex;
              
              const testRange = document.createRange();
              testRange.selectNodeContents(node);
              
              // Iterate character by character to find where line breaks
              for (let j = charIndex; j < text.length; j++) {
                testRange.setStart(node, j);
                testRange.setEnd(node, j + 1);
                
                const charRect = testRange.getBoundingClientRect();
                
                // Check if this character is on the same line (Y position within tolerance)
                const onSameLine = Math.abs(charRect.top - rect.top) < rect.height * 0.3;
                
                if (onSameLine) {
                  lineEnd = j + 1;
                } else if (j > charIndex) {
                  // We've moved to a different line, stop here
                  break;
                }
              }
              
              const lineText = text.substring(lineStart, lineEnd).trim();
              charIndex = lineEnd;
              
              if (lineText.length > 0) {
                results.push({
                  text: lineText,
                  x: rect.left,
                  y: rect.top,
                  bottom: rect.bottom,
                  width: rect.width,
                  height: rect.height,
                  fontSize: fontSize,
                  fontFamily: fontFamily,
                  fontWeight: fontWeight,
                  lineHeight: lineHeight,
                  textTransform: textTransform,
                  letterSpacing: letterSpacing,
                  estimatedBaseline: rect.top + estimatedAscent,
                  estimatedDescent: estimatedDescent,
                  elementType: elementType,
                  tagName: tagName
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
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
                fontSize: fontSize,
                fontFamily: fontFamily,
                fontWeight: fontWeight,
                lineHeight: lineHeight,
                textTransform: textTransform,
                letterSpacing: letterSpacing,
                estimatedBaseline: rect.top + estimatedAscent,
                estimatedDescent: estimatedDescent,
                elementType: elementType,
                tagName: tagName
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
  
  // Register fontkit to support custom fonts
  pdfDoc.registerFontkit(fontkit);
  
  // Load fonts (Inter or fallback to Helvetica)
  const fonts = await loadFonts(pdfDoc);
  
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
  let itemsAdjusted = 0;  // Track how many had width adjustments
  
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
    
    // Calculate element-specific offset
    let elementOffsetY = CONFIG.positioning.offsetY;  // Start with global offset
    if (item.elementType === 'heading' && item.tagName) {
      const specificOffset = CONFIG.positioning.offsetsByType[item.tagName];
      if (specificOffset !== undefined) {
        elementOffsetY += specificOffset;
      }
    } else if (item.elementType === 'body') {
      elementOffsetY += CONFIG.positioning.offsetsByType.body;
    }
    
    // Apply manual offsets BEFORE scaling
    const adjustedX = item.x + CONFIG.positioning.offsetX;
    
    // Apply font size adjustments based on element type
    let fontSizeMultiplier = CONFIG.positioning.fontSizeAdjust;
    
    // Get specific adjustment for this element type
    if (item.elementType === 'heading' && item.tagName) {
      const tagAdjustment = CONFIG.positioning.fontSizeAdjustments[item.tagName];
      if (tagAdjustment) {
        fontSizeMultiplier *= tagAdjustment;
      }
    } else if (item.elementType === 'body') {
      fontSizeMultiplier *= CONFIG.positioning.fontSizeAdjustments.body;
    }
    
    const adjustedFontSize = item.fontSize * fontSizeMultiplier;
    
    // Calculate Y position based on mode
    let adjustedY;
    
    if (CONFIG.positioning.mode === 'auto') {
      // AUTO MODE: Use the bounding box dimensions directly
      // The rect.height already represents the visual height of the text
      // Position at the bottom of the bounding box (where the baseline roughly is)
      // This works because PDF drawText positions at the baseline by default
      
      // Use the bottom of the rect as the baseline position
      // Subtract a small percentage of height for descenders
      const descentRatio = 0.15; // ~15% for descenders in Inter
      adjustedY = item.bottom - (item.height * descentRatio) + elementOffsetY;
      
    } else {
      // MANUAL MODE: Use strategy-based calculation
      switch (CONFIG.positioning.strategy) {
        case 'baseline':
          // Use estimated baseline position
          adjustedY = item.estimatedBaseline + elementOffsetY;
          break;
        case 'bottom':
          // Use bottom of bounding box minus descent
          adjustedY = (item.bottom - item.estimatedDescent) + elementOffsetY;
          break;
        case 'top':
        default:
          // Use top + fontSize (original behavior)
          adjustedY = item.y + item.fontSize + elementOffsetY;
          break;
      }
    }
    
    const pdfX = adjustedX * scaleX;
    const pdfY = pageHeight - ((adjustedY - (pageIndex * windowHeight)) * scaleY);
    let pdfFontSize = adjustedFontSize * scaleY;
    
    // Draw invisible text (opacity = 0)
    try {
      // Select appropriate font based on weight
      const fontWeight = parseInt(item.fontWeight) || 400;
      const isBold = fontWeight >= 600 || item.fontWeight === 'bold';
      const selectedFont = isBold ? fonts.bold : fonts.regular;
      
      // Apply text-transform (uppercase, lowercase, capitalize)
      let transformedText = item.text;
      if (item.textTransform) {
        switch (item.textTransform) {
          case 'uppercase':
            transformedText = transformedText.toUpperCase();
            break;
          case 'lowercase':
            transformedText = transformedText.toLowerCase();
            break;
          case 'capitalize':
            transformedText = transformedText.replace(/\b\w/g, l => l.toUpperCase());
            break;
        }
      }
      
      // Clean text to avoid encoding issues with WinAnsi
      // Replace problematic Unicode characters
      const cleanText = transformedText
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
      
      // Dynamic fontSize adjustment to match exact width
      if (CONFIG.positioning.adjustFontSizeToWidth && item.width > 0 && cleanText.length > 0) {
        // Calculate the expected width in PDF coordinates
        const expectedPdfWidth = item.width * scaleX;
        
        // Use actual font metrics to measure text width
        try {
          const actualWidthBefore = selectedFont.widthOfTextAtSize(cleanText, pdfFontSize);
          
          if (actualWidthBefore > 0) {
            // Calculate adjustment ratio
            const widthRatio = expectedPdfWidth / actualWidthBefore;
            
            if (debugMode) {
              console.log(`\n📏 "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`);
              console.log(`   Chars: ${cleanText.length} | HTML width: ${item.width.toFixed(1)}px → PDF: ${expectedPdfWidth.toFixed(1)}pt`);
              console.log(`   Font: ${pdfFontSize.toFixed(2)}pt | Calculated width: ${actualWidthBefore.toFixed(1)}pt`);
              console.log(`   Ratio: ${widthRatio.toFixed(3)} ${widthRatio < 0.7 ? '❌ TOO SMALL' : widthRatio > 1.5 ? '❌ TOO LARGE' : widthRatio < 0.95 || widthRatio > 1.05 ? '⚠️ ADJUSTED' : '✅ OK'}`);
            }
            
            // Apply adjustment (with safety bounds to avoid extreme values)
            if (widthRatio > 0.7 && widthRatio < 1.5) {
              const oldSize = pdfFontSize;
              pdfFontSize *= widthRatio;
              itemsAdjusted++;
              
              if (debugMode && Math.abs(widthRatio - 1.0) > 0.05) {
                console.log(`   → Adjusted: ${oldSize.toFixed(2)}pt → ${pdfFontSize.toFixed(2)}pt`);
              }
            }
          }
        } catch (error) {
          // Silently fail if font measurement doesn't work
          if (debugMode) {
            console.log(`   ⚠️ Width measurement failed: ${error.message}`);
          }
        }
      }
      
      page.drawText(cleanText, {
        x: pdfX,
        y: pdfY,
        size: pdfFontSize,
        font: selectedFont,
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
  if (CONFIG.positioning.adjustFontSizeToWidth) {
    console.log(`📊 Width adjustments applied: ${itemsAdjusted}/${itemsProcessed} items`);
  }
  
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
  
  // Apply fine-tuning options to CONFIG
  if (options.mode) {
    CONFIG.positioning.mode = options.mode;
  }
  if (options.adjustWidth !== undefined) {
    CONFIG.positioning.adjustFontSizeToWidth = options.adjustWidth;
  }
  if (options.offsetY !== undefined) {
    CONFIG.positioning.offsetY = options.offsetY;
  }
  if (options.offsetX !== undefined) {
    CONFIG.positioning.offsetX = options.offsetX;
  }
  if (options.strategy) {
    CONFIG.positioning.strategy = options.strategy;
  }
  
  // Apply preset adjustments
  if (options.preset) {
    const presets = {
      tight: {
        h1: 1.25, h2: 1.20, h3: 1.15, h4: 1.10, h5: 1.05, h6: 1.02, body: 0.92
      },
      normal: {
        h1: 1.20, h2: 1.15, h3: 1.10, h4: 1.05, h5: 1.02, h6: 1.00, body: 0.95
      },
      loose: {
        h1: 1.15, h2: 1.12, h3: 1.08, h4: 1.04, h5: 1.01, h6: 0.98, body: 0.98
      }
    };
    
    const selectedPreset = presets[options.preset];
    if (selectedPreset) {
      CONFIG.positioning.fontSizeAdjustments = { ...selectedPreset };
      console.log(`🎯 Applied preset: ${options.preset}`);
    } else {
      console.warn(`⚠️  Unknown preset: ${options.preset}`);
    }
  }
  
  // Apply specific offsets by type
  if (options.offsetH1 !== undefined) {
    CONFIG.positioning.offsetsByType.h1 = options.offsetH1;
  }
  if (options.offsetH2 !== undefined) {
    CONFIG.positioning.offsetsByType.h2 = options.offsetH2;
  }
  if (options.offsetH3 !== undefined) {
    CONFIG.positioning.offsetsByType.h3 = options.offsetH3;
  }
  if (options.offsetBody !== undefined) {
    CONFIG.positioning.offsetsByType.body = options.offsetBody;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🔄 PDF REHYDRATION - Adding Invisible Selectable Text');
  console.log('='.repeat(80));
  console.log(`📍 Locale: ${locale} | Theme: ${theme}`);
  console.log(`🤖 Mode: ${CONFIG.positioning.mode.toUpperCase()} ${CONFIG.positioning.mode === 'auto' ? '(smart bounding box)' : '(manual baseline)'}`);
  console.log(`📏 Width adjustment: ${CONFIG.positioning.adjustFontSizeToWidth ? 'ENABLED (pixel-perfect wrapping)' : 'disabled'}`);
  console.log(`🎯 Positioning: strategy=${CONFIG.positioning.strategy}, offsetY=${CONFIG.positioning.offsetY}, offsetX=${CONFIG.positioning.offsetX}`);
  const adj = CONFIG.positioning.fontSizeAdjustments;
  console.log(`🔤 Font sizes: h1×${adj.h1}, h2×${adj.h2}, h3×${adj.h3}, body×${adj.body}`);
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
    input: null,
    debug: false,
    mode: 'auto',  // 'auto' or 'manual'
    adjustWidth: true,  // Adjust fontSize to match width
    offsetY: 0,
    offsetX: 0,
    strategy: 'baseline',
    preset: null,  // 'tight', 'normal', 'loose', or null for manual
    offsetH1: undefined,
    offsetH2: undefined,
    offsetH3: undefined,
    offsetBody: undefined
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
    } else if (arg === '--mode' && i + 1 < args.length) {
      options.mode = args[++i];
    } else if (arg === '--no-width-adjust') {
      options.adjustWidth = false;
    } else if (arg === '--offset-y' && i + 1 < args.length) {
      options.offsetY = parseFloat(args[++i]);
    } else if (arg === '--offset-x' && i + 1 < args.length) {
      options.offsetX = parseFloat(args[++i]);
    } else if (arg === '--strategy' && i + 1 < args.length) {
      options.strategy = args[++i];
    } else if (arg === '--preset' && i + 1 < args.length) {
      options.preset = args[++i];
    } else if (arg === '--offset-h1' && i + 1 < args.length) {
      options.offsetH1 = parseFloat(args[++i]);
    } else if (arg === '--offset-h2' && i + 1 < args.length) {
      options.offsetH2 = parseFloat(args[++i]);
    } else if (arg === '--offset-h3' && i + 1 < args.length) {
      options.offsetH3 = parseFloat(args[++i]);
    } else if (arg === '--offset-body' && i + 1 < args.length) {
      options.offsetBody = parseFloat(args[++i]);
    } else if (arg === '--help') {
      console.log(`
Usage: node rehydrate-pdf.js [options]

Options:
  --locale <fr|en>              Locale to use (default: fr)
  --theme <dark|light>          Theme to use (default: dark)
  --input <path>                Path to input raster PDF (optional)
  --debug                       Show text overlay in red (for debugging alignment)
  --mode <auto|manual>          Positioning mode (default: auto)
                                  auto: Uses bounding box dimensions directly (recommended)
                                  manual: Uses calculated baseline with strategy
  --no-width-adjust             Disable automatic fontSize adjustment for width matching
  --strategy <method>           Positioning strategy for manual mode: 'baseline', 'top', or 'bottom'
  --offset-y <pixels>           Global vertical offset (+ down, - up)
  --offset-x <pixels>           Global horizontal offset (+ right, - left)
  --offset-h1 <pixels>          Additional offset for h1 titles (added to --offset-y)
  --offset-h2 <pixels>          Additional offset for h2 titles (added to --offset-y)
  --offset-h3 <pixels>          Additional offset for h3 titles (added to --offset-y)
  --offset-body <pixels>        Additional offset for body text (added to --offset-y)
  --preset <name>               Apply preset font size adjustments: 'tight', 'normal', or 'loose'
  --help                        Show this help message

Presets:
  tight:  Larger headings, smaller body (h1:1.25, h2:1.20, body:0.92)
  normal: Balanced adjustments (h1:1.20, h2:1.15, body:0.95) [default]
  loose:  Smaller adjustments (h1:1.15, h2:1.12, body:0.98)

Examples:
  # Recommended: Auto mode with width adjustment (pixel-perfect)
  node rehydrate-pdf.js --debug
  node rehydrate-pdf.js --debug --preset normal
  
  # Fine-tune with small offsets if needed
  node rehydrate-pdf.js --debug --offset-y -0.5
  
  # Disable width adjustment if it causes issues
  node rehydrate-pdf.js --debug --no-width-adjust
  
  # Final version (without debug)
  node rehydrate-pdf.js --preset normal
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
