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
const CONFIG = {
  cssInput: path.join(__dirname, 'style.css'),
  cssOutput: path.join(__dirname, 'style.min.css'),
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
async function minifyCssFile() {
  console.log(`🎨 Minifying CSS: ${CONFIG.cssInput} → ${CONFIG.cssOutput}`);

  try {
    const css = fs.readFileSync(CONFIG.cssInput, 'utf8');
    const result = await postcss([cssnano]).process(css, { from: CONFIG.cssInput });

    fs.writeFileSync(CONFIG.cssOutput, result.css, 'utf8');
    console.log(`✅ CSS minified successfully (${(css.length - result.css.length) / 1024} KiB saved)`);
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

  // Minify CSS
  const cssSuccess = await minifyCssFile();

  // Minify JavaScript files
  let jsSuccessCount = 0;
  for (const jsFile of CONFIG.jsFiles) {
    const success = await minifyJsFile(jsFile);
    if (success) jsSuccessCount++;
  }

  console.log('----------------------------------');
  console.log('📊 Build Summary:');
  console.log(`- CSS: ${cssSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`- JS: ${jsSuccessCount}/${CONFIG.jsFiles.length} files successful`);

  if (cssSuccess && jsSuccessCount === CONFIG.jsFiles.length) {
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