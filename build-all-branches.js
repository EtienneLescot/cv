#!/usr/bin/env node
/**
 * Build all configured branches
 * Used by CI to build multiple branches at once
 * 
 * This script:
 * 1. Reads build.config.json
 * 2. For each enabled branch:
 *    - Creates a Git worktree
 *    - Installs dependencies
 *    - Builds HTML and PDFs
 *    - Copies outputs to dist/
 *    - Cleans up worktree
 * 
 * Usage:
 *   node build-all-branches.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = require('./build.config.json');

/**
 * Execute command and log output
 */
function exec(command, options = {}) {
  console.log(`\n$ ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Check if running in CI environment
 */
function isCI() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Build a single branch
 */
async function buildBranch(branchName, branchConfig) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Building branch: ${branchName} (${branchConfig.displayName})`);
  console.log(`${'='.repeat(80)}\n`);

  const worktreePath = path.join(__dirname, '.worktree', branchName);
  
  try {
    // Clean up any existing worktree
    if (fs.existsSync(worktreePath)) {
      console.log(`🗑️  Removing existing worktree: ${worktreePath}`);
      exec(`git worktree remove --force ${worktreePath}`);
    }

    // Determine the ref to checkout
    // In CI, use origin/branchName, locally use branchName
    const ref = isCI() ? `origin/${branchName}` : branchName;
    
    // Create worktree
    console.log(`📁 Creating worktree for ${ref}...`);
    exec(`git worktree add --force ${worktreePath} ${ref}`);

    // Check if worktree was created
    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Failed to create worktree at ${worktreePath}`);
    }

    // Install dependencies in worktree
    console.log(`\n📦 Installing dependencies...`);
    exec('npm ci', { cwd: worktreePath });

    // Install Playwright in CI
    if (isCI()) {
      console.log(`\n🎭 Installing Playwright browsers...`);
      exec('npx playwright install --with-deps', { cwd: worktreePath });
    }

    // Build in worktree
    console.log(`\n🔨 Building...`);
    const outputPath = branchConfig.outputPath;
    const basePath = outputPath ? `/cv/${outputPath}` : '/cv';
    
    exec('node build.js', {
      cwd: worktreePath,
      env: {
        ...process.env,
        BASE_PATH: basePath,
        BRANCH_NAME: branchName
      }
    });

    // Copy outputs to main dist/ directory
    console.log(`\n📋 Copying outputs to main dist/ directory...`);
    
    const worktreeWebDir = outputPath
      ? path.join(worktreePath, CONFIG.build.outputDirs.web, outputPath)
      : path.join(worktreePath, CONFIG.build.outputDirs.web);
    
    const worktreePdfDir = outputPath
      ? path.join(worktreePath, CONFIG.build.outputDirs.pdf, outputPath)
      : path.join(worktreePath, CONFIG.build.outputDirs.pdf);
    
    const mainWebDir = outputPath
      ? path.join(__dirname, CONFIG.build.outputDirs.web, outputPath)
      : path.join(__dirname, CONFIG.build.outputDirs.web);
    
    const mainPdfDir = outputPath
      ? path.join(__dirname, CONFIG.build.outputDirs.pdf, outputPath)
      : path.join(__dirname, CONFIG.build.outputDirs.pdf);

    // Ensure target directories exist
    fs.mkdirSync(mainWebDir, { recursive: true });
    fs.mkdirSync(mainPdfDir, { recursive: true });

    // Copy web files
    if (fs.existsSync(worktreeWebDir)) {
      console.log(`   Copying ${worktreeWebDir} → ${mainWebDir}`);
      exec(`cp -r ${worktreeWebDir}/* ${mainWebDir}/`);
    } else {
      console.warn(`   ⚠️  Web directory not found: ${worktreeWebDir}`);
    }

    // Copy PDF files to dist/pdf/ (for Git tracking)
    if (fs.existsSync(worktreePdfDir)) {
      console.log(`   Copying ${worktreePdfDir} → ${mainPdfDir}`);
      exec(`cp -r ${worktreePdfDir}/* ${mainPdfDir}/`);
    } else {
      console.warn(`   ⚠️  PDF directory not found: ${worktreePdfDir}`);
    }

    // ALSO copy PDFs to dist/web/pdf/ for GitHub Pages serving
    const mainWebPdfDir = outputPath
      ? path.join(__dirname, CONFIG.build.outputDirs.web, outputPath, 'pdf')
      : path.join(__dirname, CONFIG.build.outputDirs.web, 'pdf');
    
    if (fs.existsSync(worktreePdfDir)) {
      fs.mkdirSync(mainWebPdfDir, { recursive: true });
      console.log(`   Copying ${worktreePdfDir} → ${mainWebPdfDir} (for GitHub Pages)`);
      exec(`cp -r ${worktreePdfDir}/* ${mainWebPdfDir}/`);
    }

    console.log(`\n✅ Branch ${branchName} built successfully!`);

  } catch (error) {
    console.error(`\n❌ Failed to build branch ${branchName}:`, error.message);
    throw error;
  } finally {
    // Clean up worktree
    if (fs.existsSync(worktreePath)) {
      console.log(`\n🧹 Cleaning up worktree...`);
      try {
        exec(`git worktree remove --force ${worktreePath}`);
      } catch (error) {
        console.warn(`⚠️  Failed to remove worktree: ${error.message}`);
      }
    }
  }
}

/**
 * Main function
 */
async function buildAll() {
  console.log('🚀 Building all configured branches...\n');

  // Get enabled branches
  const enabledBranches = Object.entries(CONFIG.branches)
    .filter(([name, config]) => config.enabled)
    .map(([name, config]) => ({ name, ...config }));

  if (enabledBranches.length === 0) {
    console.log('⚠️  No branches are enabled in build.config.json');
    process.exit(0);
  }

  console.log(`📋 Branches to build: ${enabledBranches.map(b => b.name).join(', ')}\n`);

  // Ensure dist directories exist
  fs.mkdirSync(CONFIG.build.outputDirs.web, { recursive: true });
  fs.mkdirSync(CONFIG.build.outputDirs.pdf, { recursive: true });

  // Build each branch
  let successCount = 0;
  let failCount = 0;

  for (const branch of enabledBranches) {
    try {
      await buildBranch(branch.name, branch);
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed to build ${branch.name}`);
      failCount++;
      
      // In CI, fail fast
      if (isCI()) {
        throw error;
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Build Summary');
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Output directory: ${CONFIG.build.outputDirs.web}/`);
  console.log(`📄 PDFs directory: ${CONFIG.build.outputDirs.pdf}/`);
  console.log(`${'='.repeat(80)}\n`);

  if (failCount > 0) {
    process.exit(1);
  }

  console.log('✨ All branches built successfully!');
}

// Run if called directly
if (require.main === module) {
  buildAll().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { buildAll };
