#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

console.log('🚀 Building PDF-ready assets (using style-pdf.css)');

// Minify and concatenate base CSS + PDF overrides so base layout remains
const fs = require('fs');
const postcss = require('postcss');
const cssnano = require('cssnano');
const node = process.execPath;

async function buildCombinedCss() {
  try {
    const basePath = path.join(__dirname, 'style.css');
    const pdfPath = path.join(__dirname, 'style-pdf.css');

    const baseCss = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf8') : '';
    const pdfCss = fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath, 'utf8') : '';

    // Garder le préfixe html.pdf-mode pour que les règles soient conditionnelles
    // La classe sera activée automatiquement via JS dans les pages générées

    // Minify base and pdf parts separately (so comments and spacing are cleaned)
    const baseResult = await postcss([cssnano]).process(baseCss, { from: 'style.css' });
    const pdfResult = await postcss([cssnano]).process(pdfCss, { from: 'style-pdf.css' });

    const combined = `${baseResult.css}\n${pdfResult.css}`;
    fs.writeFileSync(path.join(__dirname, 'style.min.css'), combined, 'utf8');

    console.log('✅ style.min.css generated: base + pdf overrides concatenated');
    return true;
  } catch (err) {
    console.error('❌ Failed to generate combined CSS:', err.message);
    return false;
  }
}

(async () => {
  // First, run the JS minification step (server.min.js)
  const buildMinJs = spawnSync(node, [path.join(__dirname, 'build-minify.js')], { stdio: 'inherit', env: process.env });
  if (buildMinJs.error || buildMinJs.status !== 0) {
    console.error('❌ build-minify (JS) failed');
    process.exit(buildMinJs.status || 1);
  }

  // Generate combined CSS
  const cssOk = await buildCombinedCss();
  if (!cssOk) process.exit(1);

  // Then run static locales generation
  const buildLocales = spawnSync(node, [path.join(__dirname, 'build-static-locales.js')], { stdio: 'inherit', env: process.env });
  if (buildLocales.error || buildLocales.status !== 0) {
    console.error('❌ build-static-locales failed');
    process.exit(buildLocales.status || 1);
  }

  console.log('🎉 build:pdf completed — site generated with base + pdf CSS');
})();
