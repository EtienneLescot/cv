const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const readline = require('readline');
const yaml = require('yaml');

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
    rl.question(question, (answer) => resolve(answer));
  });
}

// Load locale data
function loadLocale(localeName) {
  try {
    const yamlPath = path.join(CONFIG.localesPath, `${localeName}.yml`);
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    return yaml.parse(yamlContent);
  } catch (error) {
    console.error(`Error loading locale ${localeName}:`, error.message);
    return null;
  }
}

// Generate HTML with locale and theme
function generateLocalizedHtml(templateHtml, localeData, localeName, themeName) {
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;

  document.documentElement.lang = localeName;
  document.documentElement.setAttribute('data-theme', themeName);

  if (localeData.title) document.title = localeData.title;

  const metaDescription = document.querySelector('meta[name="description"]');
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const metaAuthor = document.querySelector('meta[name="author"]');
  const metaOgTitle = document.querySelector('meta[property="og:title"]');
  const metaOgDescription = document.querySelector('meta[property="og:description"]');
  const metaTwitterTitle = document.querySelector('meta[name="twitter:title"]');
  const metaTwitterDescription = document.querySelector('meta[name="twitter:description"]');

  if (metaDescription && localeData['profile-desc']) metaDescription.setAttribute('content', localeData['profile-desc']);
  if (metaKeywords && localeData.keywords) metaKeywords.setAttribute('content', localeData.keywords);
  if (metaAuthor && localeData.name) metaAuthor.setAttribute('content', localeData.name);
  if (metaOgTitle && localeData.title) metaOgTitle.setAttribute('content', localeData.title);
  if (metaOgDescription && localeData['profile-desc']) metaOgDescription.setAttribute('content', localeData['profile-desc']);
  if (metaTwitterTitle && localeData.title) metaTwitterTitle.setAttribute('content', localeData.title);
  if (metaTwitterDescription && localeData['profile-desc']) metaTwitterDescription.setAttribute('content', localeData['profile-desc']);

  const langButton = document.getElementById('lang-button');
  const themeToggle = document.getElementById('toggle');
  const printBtn = document.getElementById('print-btn');

  if (langButton && localeData['lang-label']) langButton.setAttribute('aria-label', localeData['lang-label']);
  if (themeToggle && localeData['theme-label']) themeToggle.setAttribute('aria-label', localeData['theme-label']);
  if (printBtn && localeData['download-label']) printBtn.setAttribute('aria-label', localeData['download-label']);

  const i18nElements = document.querySelectorAll('[data-i18n]');
  i18nElements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = localeData[key];
    if (translation !== undefined) element.innerHTML = translation;
  });

  return dom.serialize();
}

// Apply PDF-specific optimizations to CSS
function optimizeCssForPdf(css, themeName) {
  // Extract @media print and @page rules from the main CSS
  const printMediaRegex = /@media print\s*{[^}]*}/gs;
  const pageRuleRegex = /@page\s*{[^}]*}/gs;

  const printMediaRules = css.match(printMediaRegex)?.join('\n') || '';
  const pageRules = css.match(pageRuleRegex)?.join('\n') || '';

  // Replace the background in @page rule with theme-aware value
  const themeAwarePageRule = pageRules.replace(
    /(background\s*:)[^;!]*/,
    `$1 ${themeName === 'dark' ? '#1A1A1A' : '#ffffff'} !important`
  );

  // Combine the extracted rules with our theme-aware page rule
  const pdfOptimizations = `
${printMediaRules}

${themeAwarePageRule}
`;

  return css + pdfOptimizations;
}

// Remove emojis from text nodes for safe mode
function removeEmojisFromTextNodes(dom) {
  const walker = dom.window.document.createTreeWalker(
    dom.window.document.body,
    dom.window.NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    node.nodeValue = node.nodeValue.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  }
}

function removeEmojisOnly(dom) {
  const walker = dom.window.document.createTreeWalker(
    dom.window.document.body,
    dom.window.NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const emojiRegex = /[\p{Emoji}]/gu; // Removes only Unicode emojis

  let node;
  while ((node = walker.nextNode())) {
    node.nodeValue = node.nodeValue.replace(emojiRegex, '');
  }
}

async function generatePdf() {
  console.log('PDF Generator with Language, Theme Selection, and Safe Mode');
  console.log('========================================================');

  try {
    // Language selection
    console.log('\nAvailable languages:');
    CONFIG.supportedLocales.forEach((locale, index) => console.log(`  ${index + 1}. ${locale.toUpperCase()}`));
    const langChoice = await askQuestion('\nSelect language (1-2): ');
    const selectedLocaleIndex = parseInt(langChoice) - 1;
    const selectedLocale = (selectedLocaleIndex >= 0 && selectedLocaleIndex < CONFIG.supportedLocales.length) ? CONFIG.supportedLocales[selectedLocaleIndex] : CONFIG.defaultLocale;

    // Theme selection
    console.log('\nAvailable themes:');
    CONFIG.supportedThemes.forEach((theme, index) => console.log(`  ${index + 1}. ${theme}`));
    const themeChoice = await askQuestion('\nSelect theme (1-2): ');
    const selectedThemeIndex = parseInt(themeChoice) - 1;
    const selectedTheme = (selectedThemeIndex >= 0 && selectedThemeIndex < CONFIG.supportedThemes.length) ? CONFIG.supportedThemes[selectedThemeIndex] : CONFIG.defaultTheme;

    // Safe mode
    const safeModeChoice = await askQuestion('\nEnable safe mode? (Encodes emojis/special chars for CV importers) (y/n): ');
    const isSafeMode = safeModeChoice.trim().toLowerCase() === 'y';

    // Output
    const defaultOutputDir = './exports';
    let defaultOutputFile = `cv-${selectedLocale}-${selectedTheme}${isSafeMode ? '-safe' : ''}.pdf`;
    const defaultOutputPath = path.join(defaultOutputDir, defaultOutputFile);
    if (!fs.existsSync(defaultOutputDir)) fs.mkdirSync(defaultOutputDir, { recursive: true });
    const outputChoice = await askQuestion(`\nOutput path and filename (default: ${defaultOutputPath}): `);
    const outputFile = outputChoice.trim() || defaultOutputPath;
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log(`\n⚙️  Generating PDF with: Language=${selectedLocale}, Theme=${selectedTheme}, Output=${outputFile}`);

    // Load template and locale
    const templateHtml = fs.readFileSync(CONFIG.templatePath, 'utf8');
    const localeData = loadLocale(selectedLocale);
    if (!localeData) throw new Error(`Failed to load locale: ${selectedLocale}`);

    let localizedHtml = generateLocalizedHtml(templateHtml, localeData, selectedLocale, selectedTheme);

    const cssFile = process.argv[2] || 'style.css';
    const css = fs.readFileSync(cssFile, 'utf8');
    const optimizedCss = optimizeCssForPdf(css, selectedTheme);

    let finalHtml = localizedHtml.replace(/<link rel="stylesheet" href=".*?">/, `<style>${optimizedCss}</style>`);

    if (isSafeMode) {
      console.log('🛡️  Applying safe mode (removing emojis)');
      const dom = new JSDOM(finalHtml);
      removeEmojisFromTextNodes(dom);
      finalHtml = dom.serialize();
    }

    console.log('\n🔄 Generating PDF...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });
    await browser.close();

    console.log(`\n✅ PDF generated successfully: ${outputFile}`);
  } catch (err) {
    console.error('\n❌ Error generating PDF:', err.message);
  } finally {
    rl.close();
  }
}

generatePdf();
