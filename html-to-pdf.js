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
   PDF-SPECIFIC OPTIMIZATIONS
   ================================================================= */

/* PDF Layout Optimization */
@media print, screen {
  /* Force single-column layout for light theme in PDF */
  [data-theme="light"] .container {
    display: block !important;
    max-width: none !important;
  }
  
  [data-theme="light"] .grid-item {
    display: block !important;
    margin-bottom: 1.5rem !important;
    page-break-inside: avoid;
  }
  
  /* PDF-optimized spacing */
  [data-theme="light"] .section {
    margin-bottom: 1.2rem !important;
  }
  
  [data-theme="light"] h1 {
    font-size: 2.2rem !important;
    margin: 1rem 0 !important;
    text-align: center !important;
    page-break-after: avoid;
  }
  
  [data-theme="light"] h2 {
    font-size: 1.4rem !important;
    margin: 1.5rem 0 0.8rem 0 !important;
    page-break-after: avoid;
  }
  
  /* Optimize contact section for PDF */
  [data-theme="light"] .contact-section .neonbox {
    background: #f8f9fa !important;
    color: #2c3e50 !important;
    border: 1px solid #dee2e6 !important;
  }
  
  [data-theme="light"] .contact-section a {
    color: #2980b9 !important;
  }
  
  /* Optimize projects highlight for PDF */
  [data-theme="light"] .projects-highlight {
    background: #f8f9fa !important;
    margin: 1rem 0 !important;
    padding: 1.2rem !important;
    border: 1px solid #dee2e6 !important;
    border-radius: 8px !important;
  }
  
  /* Remove interactive elements */
  .top-right-buttons,
  #toggle,
  #lang-button,
  #print-btn,
  .lang-dropdown {
    display: none !important;
  }
  
  /* Optimize typography for print */
  body {
    font-size: 11pt !important;
    line-height: 1.4 !important;
  }
  
  [data-theme="light"] ul li {
    margin-bottom: 0.4rem !important;
    font-size: 10pt !important;
  }
  
  /* Dark theme PDF optimizations */
  [data-theme="dark"] {
    --bg: #1a1a1a !important;
    --text: #e0e0e0 !important;
    --accent: #00d4aa !important;
  }
  
  [data-theme="dark"] .neonbox {
    border: 1px solid #00d4aa !important;
    background: #2a2a2a !important;
  }
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
async function generatePdf() {
  console.log('🚀 PDF Generator with Language and Theme Selection');
  console.log('================================================');

  try {
    // Language selection
    console.log('\n📋 Available languages:');
    CONFIG.supportedLocales.forEach((locale, index) => {
      console.log(`  ${index + 1}. ${locale.toUpperCase()} (${locale === 'fr' ? 'Français' : 'English'})`);
    });

    const langChoice = await askQuestion('\n🌐 Select language (1-2): ');
    const selectedLocaleIndex = parseInt(langChoice) - 1;
    
    if (selectedLocaleIndex < 0 || selectedLocaleIndex >= CONFIG.supportedLocales.length) {
      console.log('❌ Invalid language selection. Using default (fr).');
      var selectedLocale = CONFIG.defaultLocale;
    } else {
      var selectedLocale = CONFIG.supportedLocales[selectedLocaleIndex];
    }

    // Theme selection
    console.log('\n🎨 Available themes:');
    CONFIG.supportedThemes.forEach((theme, index) => {
      console.log(`  ${index + 1}. ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
    });

    const themeChoice = await askQuestion('\n🌙 Select theme (1-2): ');
    const selectedThemeIndex = parseInt(themeChoice) - 1;
    
    if (selectedThemeIndex < 0 || selectedThemeIndex >= CONFIG.supportedThemes.length) {
      console.log('❌ Invalid theme selection. Using default (dark).');
      var selectedTheme = CONFIG.defaultTheme;
    } else {
      var selectedTheme = CONFIG.supportedThemes[selectedThemeIndex];
    }

    // Output filename
    const defaultOutput = `cv-${selectedLocale}-${selectedTheme}.pdf`;
    const outputChoice = await askQuestion(`\n📄 Output filename (default: ${defaultOutput}): `);
    const outputFile = outputChoice.trim() || defaultOutput;

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
    const finalHtml = localizedHtml.replace(
      /<link rel="stylesheet" href=".*?">/,
      `<style>${optimizedCss}</style>`
    );

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