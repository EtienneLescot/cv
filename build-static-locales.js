#!/usr/bin/env node
/**
 * Static Site Generator for Multi-Locale Support
 * Uses proper DOM parsing to handle complex HTML content with nested tags
 * Generates static HTML files for each locale
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const glob = require('glob');

// Configuration
const CONFIG = {
  templatePath: path.join(__dirname, 'index-template.html'),
  localesPath: path.join(__dirname, 'locales'),
  outputPattern: 'index-{locale}.html',
  defaultLocale: 'fr',
  supportedLocales: ['fr', 'en']
};

/**
 * Load and validate locale files
 */
function loadLocales() {
  const localeFiles = glob.sync(`${CONFIG.localesPath}/*.json`);
  const locales = {};

  localeFiles.forEach(filePath => {
    try {
      const localeName = path.basename(filePath, '.json');
      const localeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      locales[localeName] = localeData;
      console.log(`✓ Loaded locale: ${localeName} (${Object.keys(localeData).length} keys)`);
    } catch (error) {
      console.error(`✗ Error loading locale file ${filePath}:`, error.message);
      process.exit(1);
    }
  });

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

  // Update title
  if (localeData.title) {
    document.title = localeData.title;
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

  // Add language selection dropdown
  const langMenu = document.getElementById('lang-menu');
  const langButton = document.getElementById('lang-button');
  if (langMenu && langButton) {
    // Clear existing options
    langMenu.innerHTML = '';

    // Add language options
    CONFIG.supportedLocales.forEach(locale => {
      const li = document.createElement('li');
      li.textContent = locale.toUpperCase();
      li.dataset.href = locale === CONFIG.defaultLocale ? './index.html' : `./index-${locale}.html`;

      // Disable current language
      if (locale === localeName) {
        li.classList.add('disabled');
        // Set the button text to the current language
        langButton.textContent = locale.toUpperCase();
      }

      langMenu.appendChild(li);
    });
  }

  // Serialize the document back to HTML
  return dom.serialize();
}

/**
 * Save generated HTML to file
 */
function saveOutputFile(outputHtml, localeName) {
  const outputPath = path.join(__dirname, CONFIG.outputPattern.replace('{locale}', localeName));

  try {
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
function buildStaticLocales() {
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
  CONFIG.supportedLocales.forEach(localeName => {
    if (locales[localeName]) {
      console.log(`\n🌐 Processing locale: ${localeName}`);
      const outputHtml = generateStaticHtml(templateHtml, locales[localeName], localeName);

      // For default locale, also generate index.html
      if (localeName === CONFIG.defaultLocale) {
        const defaultOutputPath = path.join(__dirname, 'index.html');
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
      }
    } else {
      console.warn(`⚠ Locale ${localeName} not found in locale files`);
    }
  });

  console.log('--------------------------------------------------------');
  console.log(`🎉 Build completed: ${successCount}/${CONFIG.supportedLocales.length} files generated`);

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
buildStaticLocales();