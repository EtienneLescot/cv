#!/usr/bin/env node
/**
 * Clean build outputs
 * Usage:
 *   node scripts/clean.js          # Clean all
 *   node scripts/clean.js --web    # Clean web only
 *   node scripts/clean.js --pdf    # Clean pdf only
 */

const fs = require('fs');
const path = require('path');

const CONFIG = require('../build.config.json');

/**
 * Recursively remove a directory
 */
function removeDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory doesn't exist: ${dir}`);
    return;
  }

  console.log(`🗑️  Removing: ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`✅ Removed: ${dir}`);
}

/**
 * Main clean function
 */
function clean() {
  const args = process.argv.slice(2);
  const webOnly = args.includes('--web');
  const pdfOnly = args.includes('--pdf');

  console.log('🧹 Cleaning build outputs...\n');

  if (webOnly) {
    removeDir(CONFIG.build.outputDirs.web);
  } else if (pdfOnly) {
    removeDir(CONFIG.build.outputDirs.pdf);
  } else {
    // Clean all
    removeDir(CONFIG.build.outputDirs.web);
    removeDir(CONFIG.build.outputDirs.pdf);
    
    // Also clean generated HTML files at root
    const htmlFiles = ['index.html', 'index-fr.html', 'index-en.html'];
    htmlFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        console.log(`🗑️  Removing: ${file}`);
        fs.unlinkSync(filePath);
      }
    });
    
    // Clean minified CSS
    const cssFiles = ['style.min.css', 'style-web.min.css'];
    cssFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        console.log(`🗑️  Removing: ${file}`);
        fs.unlinkSync(filePath);
      }
    });
  }

  console.log('\n✨ Clean complete!');
}

// Run if called directly
if (require.main === module) {
  clean();
}

module.exports = { clean };
