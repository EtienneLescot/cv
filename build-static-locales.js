#!/usr/bin/env node
/**
 * Static Site Generator for Multi-Locale Support
 * Uses proper DOM parsing to handle complex HTML content with nested tags
 * Generates static HTML files for each locale
 * Supports both JSON and YAML localization files
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const glob = require('glob');
const yaml = require('yaml');
const { minify: minifyJs } = require('terser');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  templatePath: path.join(__dirname, 'index-template.html'),
  localesPath: path.join(__dirname, 'locales'),
  outputPattern: 'index-{locale}.html',
  defaultLocale: 'fr',
  supportedLocales: ['fr', 'en'],
  // Base path for resources (empty for root, '/360' for subfolder)
  basePath: process.env.BASE_PATH || '',
  // Output directory (empty for current directory)
  outputDir: process.env.OUTPUT_DIR || ''
};

function getBranchName() {
  const envBranch = process.env.BRANCH_NAME || process.env.GITHUB_REF_NAME;
  if (envBranch) {
    return envBranch;
  }

  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('⚠ Unable to detect git branch, defaulting to "main"');
    return 'main';
  }
}

/**
 * Load and validate locale files
 * Supports both JSON and YAML formats
 * YAML files take precedence over JSON files
 */
function loadLocales() {
  const locales = {};

  // First, load all YAML files
  const yamlPatterns = [
    `${CONFIG.localesPath}/*.yml`,
    `${CONFIG.localesPath}/*.yaml`
  ];

  yamlPatterns.forEach(pattern => {
    const localeFiles = glob.sync(pattern);
    console.log(`Searching YAML files with pattern ${pattern}: ${localeFiles.length} files found`);

    localeFiles.forEach(filePath => {
      try {
        const ext = path.extname(filePath);
        const localeName = path.basename(filePath, ext);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const localeData = yaml.parse(fileContent);

        locales[localeName] = localeData;
        console.log(`✓ Loaded locale: ${localeName} (${Object.keys(localeData).length} keys) from ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`✗ Error loading locale file ${filePath}:`, error.message);
        process.exit(1);
      }
    });
  });

  // Then, load JSON files only if no YAML file exists for that locale
  const jsonPattern = `${CONFIG.localesPath}/*.json`;
  const jsonFiles = glob.sync(jsonPattern);
  console.log(`Searching JSON files with pattern ${jsonPattern}: ${jsonFiles.length} files found`);

  jsonFiles.forEach(filePath => {
    try {
      const localeName = path.basename(filePath, '.json');

      // Only load JSON if no YAML file was already loaded for this locale
      if (!locales[localeName]) {
        const localeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        locales[localeName] = localeData;
        console.log(`✓ Loaded locale: ${localeName} (${Object.keys(localeData).length} keys) from ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`✗ Error loading locale file ${filePath}:`, error.message);
      process.exit(1);
    }
  });

  console.log(`Available locales: ${Object.keys(locales).join(', ')}`);
  return locales;
}

/**
 * Generate static HTML for a specific locale
 */
function generateStaticHtml(templateHtml, localeData, localeName) {
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;

  // Update document language
  document.documentElement.lang = localeName;
  document.documentElement.setAttribute('data-base-path', CONFIG.basePath);
  
  // NE PAS activer le mode PDF pour la version web !
  // La version web utilise style-web.css au lieu de style-pdf.css
  // document.documentElement.classList.add('pdf-mode');  // <-- SUPPRIMÉ

  // Update CSS: charger style.css ET style-web.css pour la version web
  const cssLink = document.querySelector('link[rel="stylesheet"]');
  if (cssLink) {
    // Remplacer le lien unique par deux liens: style.min.css + style-web.min.css
    cssLink.href = CONFIG.basePath ? `${CONFIG.basePath}/style.min.css` : 'style.min.css';
    
    // Ajouter style-web.css après style.css
    const webCssLink = document.createElement('link');
    webCssLink.rel = 'stylesheet';
    webCssLink.href = CONFIG.basePath ? `${CONFIG.basePath}/style-web.min.css` : 'style-web.min.css';
    cssLink.parentNode.insertBefore(webCssLink, cssLink.nextSibling);
  }

  // Update title
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
      // Use proper DOM methods to set content, preserving HTML structure
      element.innerHTML = translation;
    } else {
      console.warn(`⚠ Missing translation for key: "${key}" in locale ${localeName}`);
    }
  });

  // Inject GitHub and Online CV links under contact section
  const branchName = getBranchName();
  const githubUrl = 'https://github.com/EtienneLescot';
  const baseUrl = 'https://etiennelescot.github.io';
  const cvPath = CONFIG.basePath || '/cv';
  const cvUrl = `${baseUrl}${cvPath}`;

  const cvUrlFinal = localeName === 'en' ? `${cvUrl}/index-en.html` : cvUrl;

  const githubEl = document.querySelector('[data-contact-github]');
  if (githubEl) {
    // Use localized full HTML if provided in locale files, else fall back to default
    if (localeData['contact-github']) {
      githubEl.innerHTML = localeData['contact-github'];
    } else {
      const githubLabel = localeName === 'en' ? 'GitHub' : 'Github';
      githubEl.innerHTML = `${githubLabel} : <a href="${githubUrl}" target="_blank">${githubUrl}</a>`;
    }
  }

  const cvEl = document.querySelector('[data-contact-cv]');
  if (cvEl) {
    if (localeData['contact-cv']) {
      cvEl.innerHTML = localeData['contact-cv'];
    } else {
      const cvLabel = localeName === 'en' ? 'Online CV' : 'CV en ligne';
      cvEl.innerHTML = `${cvLabel} : <a href="${cvUrlFinal}" target="_blank">${cvUrlFinal}</a>`;
    }
  }

  // Add language selection dropdown
  const langMenu = document.getElementById('lang-menu');
  const langButtonRef = document.getElementById('lang-button');
  if (langMenu && langButtonRef) {
    // Clear existing options
    langMenu.innerHTML = '';

    // Add language options
    CONFIG.supportedLocales.forEach(locale => {
      const li = document.createElement('li');
      li.textContent = locale.toUpperCase();
      
      // Build correct href based on base path
      let href = locale === CONFIG.defaultLocale ? './index.html' : `./index-${locale}.html`;
      if (CONFIG.basePath) {
        href = `${CONFIG.basePath}/${href}`;
      }
      li.dataset.href = href;

      // Disable current language
      if (locale === localeName) {
        li.classList.add('disabled');
        // Set the button text to the current language
        langButtonRef.textContent = locale.toUpperCase();
      }

      langMenu.appendChild(li);
    });
  }

  // Serialize the document back to HTML
  return dom.serialize();
}

/**
 * Minify inline JavaScript in HTML
 */
async function minifyInlineScripts(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  // Find all script tags
  const scriptTags = document.querySelectorAll('script');

  for (const script of scriptTags) {
    if (!script.src) { // Only process inline scripts
      const scriptContent = script.textContent;

      try {
        const minified = await minifyJs(scriptContent, {
          sourceMap: false,
          compress: {
            passes: 2
          },
          mangle: true
        });

        script.textContent = minified.code;
        console.log(`✅ Minified inline script (${(scriptContent.length - minified.code.length)} bytes saved)`);
      } catch (error) {
        console.warn(`⚠ Failed to minify inline script:`, error.message);
      }
    }
  }

  return dom.serialize();
}

/**
 * Save generated HTML to file
 */
function saveOutputFile(outputHtml, localeName) {
  let outputPath = CONFIG.outputPattern.replace('{locale}', localeName);
  if (CONFIG.outputDir) {
    outputPath = path.join(CONFIG.outputDir, outputPath);
  } else {
    outputPath = path.join(__dirname, outputPath);
  }

  try {
    // Ensure output directory exists
    if (CONFIG.outputDir) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, outputHtml, 'utf8');
    console.log(`✓ Generated: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to write output file ${outputPath}:`, error.message);
    return false;
  }
}

/**
 * Main build process
 */
async function buildStaticLocales() {
  console.log('🚀 Starting Static Site Generation for Multi-Locale Support');
  console.log('--------------------------------------------------------');

  // Load template
  let templateHtml;
  try {
    templateHtml = fs.readFileSync(CONFIG.templatePath, 'utf8');
    console.log(`✓ Loaded template: ${CONFIG.templatePath}`);
  } catch (error) {
    console.error(`✗ Failed to load template file:`, error.message);
    process.exit(1);
  }

  // Load locales
  const locales = loadLocales();

  // Generate files for each locale
  let successCount = 0;
  for (const localeName of CONFIG.supportedLocales) {
    if (locales[localeName]) {
      console.log(`\n🌐 Processing locale: ${localeName}`);
      let outputHtml = generateStaticHtml(templateHtml, locales[localeName], localeName);

      // Minify inline JavaScript
      outputHtml = await minifyInlineScripts(outputHtml);

      // For default locale, also generate index.html
      if (localeName === CONFIG.defaultLocale) {
        let defaultOutputPath = 'index.html';
        if (CONFIG.outputDir) {
          defaultOutputPath = path.join(CONFIG.outputDir, defaultOutputPath);
          // Ensure output directory exists
          fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        } else {
          defaultOutputPath = path.join(__dirname, defaultOutputPath);
        }
        try {
          fs.writeFileSync(defaultOutputPath, outputHtml, 'utf8');
          console.log(`✓ Generated: ${defaultOutputPath}`);
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to write default file ${defaultOutputPath}:`, error.message);
        }
      }

      // Generate locale-specific file
      if (saveOutputFile(outputHtml, localeName)) {
        successCount++;
        // Also generate a PDF-debug HTML variant (index-<locale>-pdf.html)
        try {
          const pdfDom = new JSDOM(outputHtml);
          const { document: pdfDoc } = pdfDom.window;

          // Mark page as pdf-mode for debug and remove web-only stylesheet
          pdfDoc.documentElement.classList.add('pdf-mode');

          // Fix CSS links: ensure main.css exists and add pdf-ats.css, remove web css
          const cssLink = pdfDoc.querySelector('link[rel="stylesheet"]');
          if (cssLink) {
            cssLink.href = CONFIG.basePath ? `${CONFIG.basePath}/style.min.css` : 'style.min.css';

            // Remove any existing web CSS link
            const webCss = pdfDoc.querySelector('link[href*="style-web"], link#web-css');
            if (webCss && webCss.parentNode) webCss.parentNode.removeChild(webCss);

            // Add PDF ATS CSS after main css
            const pdfCssLink = pdfDoc.createElement('link');
            pdfCssLink.rel = 'stylesheet';
            pdfCssLink.id = 'pdf-ats-css';
            pdfCssLink.href = CONFIG.basePath ? `${CONFIG.basePath}/style-pdf.min.css` : 'style-pdf.min.css';
            cssLink.parentNode.insertBefore(pdfCssLink, cssLink.nextSibling);
          }

          const pdfDebugHtml = pdfDom.serialize();

          // Determine output path for pdf-debug html
          let pdfOutputPath = `index-${localeName}-pdf.html`;
          if (localeName === CONFIG.defaultLocale) pdfOutputPath = 'index-pdf.html';
          if (CONFIG.outputDir) {
            pdfOutputPath = path.join(CONFIG.outputDir, pdfOutputPath);
          } else {
            pdfOutputPath = path.join(__dirname, pdfOutputPath);
          }

          fs.writeFileSync(pdfOutputPath, pdfDebugHtml, 'utf8');
          console.log(`✓ Generated PDF debug HTML: ${pdfOutputPath}`);
        } catch (err) {
          console.warn(`⚠ Failed to generate PDF debug HTML for ${localeName}:`, err.message);
        }
      }
    } else {
      console.warn(`⚠ Locale ${localeName} not found in locale files`);
    }
  }

  console.log('--------------------------------------------------------');
  console.log(`🎉 Build completed: ${successCount}/${CONFIG.supportedLocales.length+1} files generated`);

  if (successCount === 0) {
    console.error('✗ No files were generated successfully');
    process.exit(1);
  } else if (successCount < CONFIG.supportedLocales.length) {
    console.warn('⚠ Some locales were not generated');
  } else {
    console.log('✅ All locales generated successfully!');
  }
}

// Run the build
buildStaticLocales().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});