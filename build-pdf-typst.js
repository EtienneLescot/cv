/**
 * =============================================================================
 * BUILD PDF — TYPST PIPELINE
 * =============================================================================
 *
 * Generates all CV PDF variants via Typst:
 *   - fr × dark / light
 *   - en × dark / light
 *
 * Steps:
 *   1. Run typst/preprocess.js for each locale → typst/data-{locale}.json
 *   2. Call `typst compile` for each (locale × theme) combination
 *   3. Output to dist/pdf/
 *
 * Usage:
 *   node build-pdf-typst.js
 *   node build-pdf-typst.js --locale fr --theme dark   (single variant)
 *   node build-pdf-typst.js --locale fr                (both themes for fr)
 *
 * Requirements:
 *   typst binary available on PATH (or at ~/.local/bin/typst)
 */

'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT      = __dirname;
const TYPST_DIR = path.join(ROOT, 'typst');
const FONT_DIR  = path.join(ROOT, 'fonts', 'Inter', 'extras', 'otf');
// OUTPUT_DIR env var allows build.js / CI to redirect output (e.g. dist/pdf/short)
// Always resolve to absolute path — Typst runs with cwd=typst/ so relative paths break
const OUT_DIR   = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, 'dist', 'pdf'));
const TEMPLATE  = path.join(TYPST_DIR, 'cv.typ');
const CV_URL    = 'https://etiennelescot.github.io/cv/';

const LOCALES = ['fr', 'en'];
const THEMES  = ['dark', 'light'];

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx > -1 ? args[idx + 1] : null;
}

const filterLocale = getArg('--locale');
const filterTheme  = getArg('--theme');

const locales = filterLocale ? [filterLocale] : LOCALES;
const themes  = filterTheme  ? [filterTheme]  : THEMES;

// ─── Find typst binary ────────────────────────────────────────────────────────

function findTypst() {
  const candidates = [
    'typst',                                     // on PATH
    path.join(process.env.HOME || '', '.local', 'bin', 'typst'),
    '/usr/local/bin/typst',
    '/usr/bin/typst',
  ];
  for (const bin of candidates) {
    const result = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      console.log(`[typst] Found: ${bin} (${result.stdout.trim()})`);
      return bin;
    }
  }
  throw new Error(
    'typst binary not found.\n' +
    'Install it from https://github.com/typst/typst/releases\n' +
    'or run: curl -sL https://github.com/typst/typst/releases/download/v0.14.2/typst-x86_64-unknown-linux-musl.tar.xz | tar -xJ -C ~/.local/bin --strip-components=1'
  );
}

// ─── Preprocess ───────────────────────────────────────────────────────────────

function preprocess(locale) {
  const script = path.join(TYPST_DIR, 'preprocess.js');
  console.log(`[preprocess] ${locale} ...`);
  execFileSync(process.execPath, [script, locale], {
    cwd   : ROOT,
    stdio : 'inherit',
  });
}

// ─── Compile ──────────────────────────────────────────────────────────────────

function compile(typstBin, locale, theme) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `cv-${locale}-${theme}.pdf`);
  console.log(`[typst] Compiling cv-${locale}-${theme}.pdf ...`);

  const t0 = Date.now();
  const result = spawnSync(
    typstBin,
    [
      'compile',
      '--font-path', FONT_DIR,
      '--input', `locale=${locale}`,
      '--input', `theme=${theme}`,
      '--input', `cv-url=${CV_URL}`,
      TEMPLATE,
      outFile,
    ],
    {
      cwd    : TYPST_DIR,
      encoding: 'utf8',
      stdio  : ['ignore', 'pipe', 'pipe'],
    }
  );

  if (result.status !== 0) {
    const errMsg = (result.stderr || result.stdout || '').trim();
    throw new Error(`Typst compilation failed for ${locale}-${theme}:\n${errMsg}`);
  }

  const elapsed = Date.now() - t0;
  const size    = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`[typst] ✓ cv-${locale}-${theme}.pdf  (${size} KB, ${elapsed}ms)`);
  return outFile;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  CV PDF Generator — Typst');
  console.log('══════════════════════════════════════════\n');

  // Find typst binary
  const typstBin = findTypst();

  // Preprocess each needed locale (deduplicated)
  const preprocessedLocales = new Set();
  for (const locale of locales) {
    if (!preprocessedLocales.has(locale)) {
      preprocess(locale);
      preprocessedLocales.add(locale);
    }
  }

  console.log();

  // Compile each (locale × theme) variant
  const generated = [];
  const errors    = [];

  for (const locale of locales) {
    for (const theme of themes) {
      try {
        const file = compile(typstBin, locale, theme);
        generated.push(file);
      } catch (err) {
        errors.push({ locale, theme, err });
        console.error(`[error] ${err.message}`);
      }
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`Generated: ${generated.length} PDF(s)`);
  if (errors.length) {
    console.error(`Failed:    ${errors.length} variant(s)`);
    process.exitCode = 1;
  } else {
    console.log('All variants generated successfully.');
  }
  console.log('──────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\n[fatal]', err.message);
  process.exit(1);
});
