const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const readline = require('readline');

// Configuration
const CONFIG = {
  templatePath: path.join(__dirname, 'index-template.html'),
  localesPath: path.join(__dirname, 'locales'),
  supportedLocales: ['fr', 'en'],
  supportedThemes: ['dark', 'light'],
  defaultLocale: 'fr',
  defaultTheme: 'dark'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Load locale data
function loadLocale(localeName) {
  try {
    const localePath = path.join(CONFIG.localesPath, `${localeName}.json`);
    return JSON.parse(fs.readFileSync(localePath, 'utf8'));
  } catch (error) {
    console.error(`Error loading locale ${localeName}:`, error.message);
    return null;
  }
}

// Generate HTML with locale and theme
function generateLocalizedHtml(templateHtml, localeData, localeName, themeName) {
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;

  // Set language and theme
  document.documentElement.lang = localeName;
  document.documentElement.setAttribute('data-theme', themeName);

  // Update title and meta tags
  if (localeData.title) {
    document.title = localeData.title;
  }

  // Update meta tags
  const metaDescription = document.querySelector('meta[name="description"]');
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const metaAuthor = document.querySelector('meta[name="author"]');
  const metaOgTitle = document.querySelector('meta[property="og:title"]');
  const metaOgDescription = document.querySelector('meta[property="og:description"]');
  const metaTwitterTitle = document.querySelector('meta[name="twitter:title"]');
  const metaTwitterDescription = document.querySelector('meta[name="twitter:description"]');

  if (metaDescription && localeData['profile-desc']) {
    metaDescription.setAttribute('content', localeData['profile-desc']);
  }
  if (metaKeywords && localeData.keywords) {
    metaKeywords.setAttribute('content', localeData.keywords);
  }
  if (metaAuthor && localeData.name) {
    metaAuthor.setAttribute('content', localeData.name);
  }
  if (metaOgTitle && localeData.title) {
    metaOgTitle.setAttribute('content', localeData.title);
  }
  if (metaOgDescription && localeData['profile-desc']) {
    metaOgDescription.setAttribute('content', localeData['profile-desc']);
  }
  if (metaTwitterTitle && localeData.title) {
    metaTwitterTitle.setAttribute('content', localeData.title);
  }
  if (metaTwitterDescription && localeData['profile-desc']) {
    metaTwitterDescription.setAttribute('content', localeData['profile-desc']);
  }

  // Apply aria-labels
  const langButton = document.getElementById('lang-button');
  const themeToggle = document.getElementById('toggle');
  const printBtn = document.getElementById('print-btn');

  if (langButton && localeData['lang-label']) {
    langButton.setAttribute('aria-label', localeData['lang-label']);
  }
  if (themeToggle && localeData['theme-label']) {
    themeToggle.setAttribute('aria-label', localeData['theme-label']);
  }
  if (printBtn && localeData['download-label']) {
    printBtn.setAttribute('aria-label', localeData['download-label']);
  }

  // Process all elements with data-i18n attributes
  const i18nElements = document.querySelectorAll('[data-i18n]');
  i18nElements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = localeData[key];

    if (translation !== undefined) {
      element.innerHTML = translation;
    }
  });

  return dom.serialize();
}

// Apply PDF-specific optimizations to CSS
function optimizeCssForPdf(css, themeName) {
  let optimizedCss = css;

  // Add PDF-specific styles
  const pdfOptimizations = `
/* =================================================================
   PDF-SPECIFIC OPTIMIZATIONS - Using same print media queries
   ================================================================= */
@media print {
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 10pt !important;
    line-height: 1.35 !important;
  }

  /* Grille d’impression :
     R1: header (full)
     R2: contact (col1) + profil (col2)
     R3: skills (col1) + languages (col2)
     R4: projects (full)
     R5: experiences (full)
  */
  .container {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    grid-template-rows: auto auto auto auto auto !important;
    gap: 10pt 14pt !important;
    align-items: stretch !important;
    max-width: none !important;
    padding: 0 !important;
  }

  .header-section     { grid-column: 1 / -1 !important; grid-row: 1 !important; }
  .contact-section    { grid-column: 1 !important; grid-row: 2 !important; align-self: stretch !important; }
  .profile-section    { grid-column: 2 !important; grid-row: 2 !important; align-self: stretch !important; }
  .skills-section     { grid-column: 1 !important; grid-row: 3 !important; align-self: stretch !important; }
  .languages-section  { grid-column: 2 !important; grid-row: 3 !important; align-self: stretch !important; }
  .projects-highlight { grid-column: 1 / -1 !important; grid-row: 4 !important; }
  .experiences-section{ grid-column: 1 / -1 !important; grid-row: 5 !important; }

  /* IMPORTANT : supprimer les min-heights qui empêchent l’égalisation */
  .contact-section,
  .profile-section,
  .skills-section,
  .languages-section {
    min-height: unset !important;
  }

  /* Faire “remplir la cellule” aux boîtes internes */
  .contact-section .neonbox,
  .profile-section .neonbox,
  .skills-section .neonbox,
  .languages-section .neonbox {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .contact-section .section,
  .profile-section .section,
  .skills-section .section,
  .languages-section .section {
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* Empêcher les coupures moches */
  .header-section,
  .contact-section,
  .profile-section,
  .skills-section,
  .languages-section,
  .projects-highlight,
  .experiences-section,
  .grid-item,
  .section,
  .neonbox {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Typo compacte & éviter les sauts après titres */
  h1, h2 {
    page-break-after: avoid !important;
    margin: 0 0 0.5rem 0 !important;
    background: none !important;
    -webkit-text-fill-color: inherit !important;
  }

  /* Nettoyage : éléments interactifs */
  .top-right-buttons,
  #toggle,
  #lang-button,
  #print-btn,
  .lang-dropdown {
    display: none !important;
  }

  /* -------- PALETTES LIGHT & DARK -------- */

  /* Thème clair */
  [data-theme="light"] body {
    background: #fff !important;
    color: #2c3e50 !important;
  }
  [data-theme="light"] .neonbox {
    background: #f8f9fa !important;
    border: 1px solid #dee2e6 !important;
    box-shadow: none !important;
  }
  [data-theme="light"] .contact-section .neonbox {
    background: #007BFF !important;
    color: #fff !important;
    border: none !important;
  }

  /* Thème sombre */
  [data-theme="dark"] body {
    background: #1a1a1a !important;
    color: #f8f9fa !important;
  }
  [data-theme="dark"] .neonbox {
    background: #2c2c2c !important;
    border: 2px solid #444 !important;
    box-shadow: none !important;
  }
  [data-theme="dark"] .contact-section .neonbox {
    background: #007BFF !important;
    color: #fff !important;
    border: none !important;
  }

  /* Projects highlight (barre décorative off en print) */
  .projects-highlight::before { display: none !important; }
}

@page {
  margin: 15mm;
  size: A4;
}
`;

  // Append PDF optimizations to CSS
  optimizedCss += pdfOptimizations;

  return optimizedCss;
}

// Function to escape special characters
function escapeSpecialChars(str) {
  return str.replace(/[&<>"']/g, function (char) {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

// Main PDF generation function
// Function to clean HTML content for safe mode
function cleanHtmlForSafeMode(htmlContent) {
  // Remove emojis and special characters that might cause issues with CV importers
  // This regex matches emojis, special symbols, and some unicode characters
  const safeModeRegex = /[\u{1F600}-\u{1F6FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[^\x00-\x7F]/gu;

  return htmlContent.replace(safeModeRegex, '');
}

async function generatePdf() {
  console.log('PDF Generator with Language, Theme Selection, and Safe Mode');
  console.log('========================================================');

  try {
    // Language selection
    console.log('\nAvailable languages:');
    CONFIG.supportedLocales.forEach((locale, index) => {
      console.log(`  ${index + 1}. ${locale.toUpperCase()} (${locale === 'fr' ? 'Français' : 'English'})`);
    });

    const langChoice = await askQuestion('\nSelect language (1-2): ');
    const selectedLocaleIndex = parseInt(langChoice) - 1;

    if (selectedLocaleIndex < 0 || selectedLocaleIndex >= CONFIG.supportedLocales.length) {
      console.log('Invalid language selection. Using default (fr).');
      var selectedLocale = CONFIG.defaultLocale;
    } else {
      var selectedLocale = CONFIG.supportedLocales[selectedLocaleIndex];
    }

    // Theme selection
    console.log('\nAvailable themes:');
    CONFIG.supportedThemes.forEach((theme, index) => {
      console.log(`  ${index + 1}. ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
    });

    const themeChoice = await askQuestion('\nSelect theme (1-2): ');
    const selectedThemeIndex = parseInt(themeChoice) - 1;

    if (selectedThemeIndex < 0 || selectedThemeIndex >= CONFIG.supportedThemes.length) {
      console.log('Invalid theme selection. Using default (dark).');
      var selectedTheme = CONFIG.defaultTheme;
    } else {
      var selectedTheme = CONFIG.supportedThemes[selectedThemeIndex];
    }

    // Safe mode selection
    const safeModeChoice = await askQuestion('\nEnable safe mode? (Removes emojis/special chars for CV importers) (y/n): ');
    const isSafeMode = safeModeChoice.trim().toLowerCase() === 'y';

    // Output path and filename
    const defaultOutputDir = './exports';
    let defaultOutputFile = `cv-${selectedLocale}-${selectedTheme}.pdf`;

    // Modify filename for safe mode
    if (isSafeMode) {
      defaultOutputFile = `cv-${selectedLocale}-${selectedTheme}-safe.pdf`;
    }

    const defaultOutputPath = path.join(defaultOutputDir, defaultOutputFile);

    // Ensure the exports directory exists
    if (!fs.existsSync(defaultOutputDir)){
      fs.mkdirSync(defaultOutputDir, { recursive: true });
    }

    const outputChoice = await askQuestion(`\nOutput path and filename (default: ${defaultOutputPath}): `);
    let outputFile = outputChoice.trim() || defaultOutputPath;

    // Create directories if they don't exist
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)){
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n⚙️  Generating PDF with:`);
    console.log(`   Language: ${selectedLocale.toUpperCase()}`);
    console.log(`   Theme: ${selectedTheme}`);
    console.log(`   Output: ${outputFile}`);

    // Load template and locale
    const templateHtml = fs.readFileSync(CONFIG.templatePath, 'utf8');
    const localeData = loadLocale(selectedLocale);
    
    if (!localeData) {
      throw new Error(`Failed to load locale: ${selectedLocale}`);
    }

    // Generate localized HTML
    const localizedHtml = generateLocalizedHtml(templateHtml, localeData, selectedLocale, selectedTheme);

    // Load and optimize CSS
    const cssFile = process.argv[2] || 'style.css';
    const css = fs.readFileSync(cssFile, 'utf8');
    const optimizedCss = optimizeCssForPdf(css, selectedTheme);

    // Inject optimized CSS into HTML
    let finalHtml = localizedHtml.replace(
      /<link rel="stylesheet" href=".*?">/,
      `<style>${optimizedCss}</style>`
    );

    // Apply safe mode cleaning if enabled
    if (isSafeMode) {
      console.log('🛡️  Applying safe mode - removing emojis and special characters');
      finalHtml = cleanHtmlForSafeMode(finalHtml);
    }

    // Generate PDF
    console.log('\n🔄 Generating PDF...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputFile,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });
    
    await browser.close();

    console.log(`\n✅ PDF generated successfully: ${outputFile}`);
    console.log(`   📊 Language: ${selectedLocale.toUpperCase()}`);
    console.log(`   🎨 Theme: ${selectedTheme}`);

  } catch (error) {
    console.error('\n❌ Error generating PDF:', error.message);
  } finally {
    rl.close();
  }
}

// Run the generator
generatePdf();