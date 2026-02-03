#!/usr/bin/env node
/**
 * Build script for minifying CSS and JavaScript
 * This script handles:
 * 1. CSS minification using CSSNano
 * 2. JavaScript minification using Terser
 */

const fs = require('fs');
const path = require('path');
const cssnano = require('cssnano');
const { minify: minifyJs } = require('terser');
const postcss = require('postcss');

// Configuration
// Allow overriding the CSS input file via environment variable (used by build:pdf)
const DEFAULT_CSS_INPUT = path.join(__dirname, 'style.css');
const CONFIG = {
  cssFiles: [
    {
      input: process.env.CSS_INPUT ? path.join(__dirname, process.env.CSS_INPUT) : DEFAULT_CSS_INPUT,
      output: path.join(__dirname, 'style.min.css')
    },
    {
      input: path.join(__dirname, 'style-web.css'),
      output: path.join(__dirname, 'style-web.min.css')
    }
  ],
  jsFiles: [
    {
      input: path.join(__dirname, 'server.js'),
      output: path.join(__dirname, 'server.min.js')
    }
  ]
};

/**
 * Minify CSS file
 */
async function minifyCssFile(fileConfig) {
  console.log(`🎨 Minifying CSS: ${fileConfig.input} → ${fileConfig.output}`);

  try {
    // Check if file exists
    if (!fs.existsSync(fileConfig.input)) {
      console.log(`⚠️  Skipping ${fileConfig.input} (file not found)`);
      return true; // Don't fail build if optional file is missing
    }

    const css = fs.readFileSync(fileConfig.input, 'utf8');
    const result = await postcss([cssnano]).process(css, { from: fileConfig.input });

    fs.writeFileSync(fileConfig.output, result.css, 'utf8');
    console.log(`✅ CSS minified successfully (${((css.length - result.css.length) / 1024).toFixed(2)} KiB saved)`);
    return true;
  } catch (error) {
    console.error(`❌ CSS minification failed:`, error);
    return false;
  }
}

/**
 * Minify JavaScript file
 */
async function minifyJsFile(fileConfig) {
  console.log(`📜 Minifying JS: ${fileConfig.input} → ${fileConfig.output}`);

  try {
    const js = fs.readFileSync(fileConfig.input, 'utf8');
    const result = await minifyJs(js, {
      sourceMap: false,
      compress: {
        passes: 2
      },
      mangle: true
    });

    fs.writeFileSync(fileConfig.output, result.code, 'utf8');
    console.log(`✅ JS minified successfully (${(js.length - result.code.length) / 1024} KiB saved)`);
    return true;
  } catch (error) {
    console.error(`❌ JS minification failed for ${fileConfig.input}:`, error);
    return false;
  }
}

/**
 * Main build function
 */
async function build() {
  console.log('🚀 Starting asset minification build');
  console.log('----------------------------------');

  // Minify CSS files
  let cssSuccessCount = 0;
  for (const cssFile of CONFIG.cssFiles) {
    const success = await minifyCssFile(cssFile);
    if (success) cssSuccessCount++;
  }

  // Minify JavaScript files
  let jsSuccessCount = 0;
  for (const jsFile of CONFIG.jsFiles) {
    const success = await minifyJsFile(jsFile);
    if (success) jsSuccessCount++;
  }

  console.log('----------------------------------');
  console.log('📊 Build Summary:');
  console.log(`- CSS: ${cssSuccessCount}/${CONFIG.cssFiles.length} files successful`);
  console.log(`- JS: ${jsSuccessCount}/${CONFIG.jsFiles.length} files successful`);

  if (cssSuccessCount === CONFIG.cssFiles.length && jsSuccessCount === CONFIG.jsFiles.length) {
    console.log('🎉 All assets minified successfully!');
    return true;
  } else {
    console.error('❌ Some assets failed to minify');
    return false;
  }
}

// Run the build
build().then(success => {
  if (!success) {
    process.exit(1);
  }
});