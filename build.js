#!/usr/bin/env node
/**
 * Unified build script for current branch
 * Builds HTML and PDFs for the current Git branch
 * 
 * Usage:
 *   node build.js              # Build everything (HTML + PDF)
 *   node build.js --web-only   # Build HTML only
 *   node build.js --pdf-only   # Build PDF only
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = require('./build.config.json');

/**
 * Get current Git branch name
 */
function getCurrentBranch() {
  const envBranch = process.env.BRANCH_NAME || process.env.GITHUB_REF_NAME;
  if (envBranch) {
    return envBranch;
  }

  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('⚠️  Unable to detect git branch, defaulting to "main"');
    return 'main';
  }
}

/**
 * Main build function
 */
async function build() {
  const args = process.argv.slice(2);
  const webOnly = args.includes('--web-only');
  const pdfOnly = args.includes('--pdf-only');

  // Get current branch
  const currentBranch = getCurrentBranch();
  console.log(`📦 Building branch: ${currentBranch}\n`);

  // Check if branch is configured
  const branchConfig = CONFIG.branches[currentBranch];
  if (!branchConfig) {
    console.error(`❌ Branch "${currentBranch}" is not configured in build.config.json`);
    console.log('Available branches:', Object.keys(CONFIG.branches).join(', '));
    process.exit(1);
  }

  if (!branchConfig.enabled) {
    console.log(`⚠️  Branch "${currentBranch}" is disabled in config`);
    console.log('To enable it, set "enabled": true in build.config.json');
    process.exit(0);
  }

  // Calculate output paths
  const outputPath = branchConfig.outputPath;
  const webOutputDir = outputPath 
    ? path.join(CONFIG.build.outputDirs.web, outputPath)
    : CONFIG.build.outputDirs.web;
  const pdfOutputDir = outputPath
    ? path.join(CONFIG.build.outputDirs.pdf, outputPath)
    : CONFIG.build.outputDirs.pdf;

  // Calculate BASE_PATH for links
  const basePath = outputPath ? `/cv/${outputPath}` : '/cv';

  console.log(`📁 Output directories:`);
  console.log(`   Web: ${webOutputDir}`);
  console.log(`   PDF: ${pdfOutputDir}`);
  console.log(`   Base path: ${basePath}\n`);

  // Ensure output directories exist
  fs.mkdirSync(webOutputDir, { recursive: true });
  fs.mkdirSync(pdfOutputDir, { recursive: true });

  try {
    // Build web (HTML + CSS)
    if (!pdfOnly) {
      console.log('🎨 Building web assets...\n');

      // 1. Minify CSS and JS
      execSync('node build-minify.js', {
        stdio: 'inherit',
        env: {
          ...process.env,
          OUTPUT_DIR: webOutputDir
        }
      });

      // 2. Generate static HTML files
      execSync('node build-static-locales.js', {
        stdio: 'inherit',
        env: {
          ...process.env,
          OUTPUT_DIR: webOutputDir,
          BASE_PATH: basePath,
          BRANCH_NAME: currentBranch
        }
      });
    }

    // In PDF-only mode, we still need static HTML files as PDF input
    if (pdfOnly) {
      console.log('🧩 Preparing static HTML for PDF generation...\n');

      execSync('node build-static-locales.js', {
        stdio: 'inherit',
        env: {
          ...process.env,
          OUTPUT_DIR: webOutputDir,
          BASE_PATH: basePath,
          BRANCH_NAME: currentBranch
        }
      });
    }

    // Build PDFs
    if (!webOnly) {
      console.log('\n📄 Building PDFs...\n');

      execSync('node generate-pdf.js --all --vector', {
        stdio: 'inherit',
        env: {
          ...process.env,
          HTML_DIR: webOutputDir,
          OUTPUT_DIR: pdfOutputDir,
          BASE_PATH: basePath,
          BRANCH_NAME: currentBranch
        }
      });

      // Copy PDFs to web directory for GitHub Pages serving
      const webPdfDir = path.join(webOutputDir, 'pdf');
      console.log(`\n📋 Copying PDFs to ${webPdfDir} for GitHub Pages...`);
      fs.mkdirSync(webPdfDir, { recursive: true });
      execSync(`cp -r ${pdfOutputDir}/* ${webPdfDir}/`, { stdio: 'inherit' });
    }

    console.log('\n✅ Build completed successfully!');
    console.log(`\n📂 Files generated in:`);
    if (!pdfOnly) console.log(`   ${webOutputDir}`);
    if (!webOnly) console.log(`   ${pdfOutputDir}`);

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  build().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { build };
