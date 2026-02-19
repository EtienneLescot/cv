/**
 * =============================================================================
 * TYPST CV PREPROCESSOR
 * =============================================================================
 *
 * Converts locales/fr.yml or locales/en.yml into a structured JSON file that
 * the Typst template (cv.typ) can consume directly.
 *
 * - HTML <strong> → **bold** markers (parsed in Typst)
 * - HTML <a href="url">text</a> → extracted as {text, url}
 * - HTML <br> → space
 * - Leading "- " stripped from single-item list values
 * - HTML entities decoded
 * - <span> and other tags stripped
 *
 * Usage:
 *   node typst/preprocess.js fr
 *   node typst/preprocess.js en
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('yaml');

const locale = process.argv[2] || 'fr';
const src    = path.resolve(__dirname, `../locales/${locale}.yml`);
const out    = path.resolve(__dirname, `data-${locale}.json`);

const raw = yaml.parse(fs.readFileSync(src, 'utf8'));

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Strip leading "- " from YAML block scalar list items */
function unlist(val) {
  if (!val) return '';
  return val.trim().replace(/^-\s+/, '');
}

/** Decode common HTML entities */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Convert HTML to a string with **bold** markers; strips other tags */
function htmlToRich(html) {
  if (!html) return '';
  return decodeEntities(
    html
      // Remove page-break spans entirely
      .replace(/<span[^>]*class="pdf-page-break[^"]*"[^>]*>.*?<\/span>/gi, '')
      // Convert <strong>…</strong> → **…**
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      // Convert <br> variants → space
      .replace(/<br\s*\/?>/gi, ' ')
      // Strip remaining tags
      .replace(/<[^>]+>/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract first <a href="url">text</a> from an HTML string.
 * Returns { text, url } or null.
 */
function extractLink(html) {
  const m = html.match(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/i);
  if (!m) return null;
  return {
    url : m[1],
    text: decodeEntities(m[2].replace(/<[^>]+>/g, '').trim()),
  };
}

/** Strip HTML entirely → plain text */
function stripHtml(html) {
  return htmlToRich(html).replace(/\*\*/g, '');
}

/** Get a raw field value (trimmed) */
function get(key) {
  const v = raw[key];
  return v ? v.trim() : '';
}

/** Get a field, strip leading "- " and convert HTML to rich text */
function rich(key) {
  return htmlToRich(unlist(get(key)));
}

/** Get a field as plain text (no bold markers, no HTML) */
function plain(key) {
  return stripHtml(unlist(get(key)));
}

// ─── contact parsing ──────────────────────────────────────────────────────────

function parseContactItem(key, labelFallback) {
  const raw_val = get(key);
  if (!raw_val) return null;
  const link = extractLink(raw_val);
  // Strip "- Label: " prefix
  const withoutDash = raw_val.replace(/^-\s*/, '');
  // Extract plain text (after "Label: ")
  const colonIdx = withoutDash.indexOf(':');
  const label = colonIdx > -1 ? withoutDash.slice(0, colonIdx).trim() : labelFallback;
  if (link) {
    return { label, text: link.text, url: link.url };
  }
  // No link: value is the part after the colon
  const value = colonIdx > -1
    ? decodeEntities(withoutDash.slice(colonIdx + 1).replace(/<[^>]+>/g, '').trim())
    : decodeEntities(withoutDash.replace(/<[^>]+>/g, '').trim());
  return { label, text: value };
}

// ─── skills parsing ───────────────────────────────────────────────────────────

function parseSkills() {
  const items = [];
  for (let i = 1; i <= 10; i++) {
    const key = `skill-${i}`;
    if (!raw[key]) break;
    items.push(rich(key));
  }
  return items;
}

// ─── experience parsing ───────────────────────────────────────────────────────

/**
 * Parse a list of experience points (keys like exp1-point1, exp1-point2, …)
 * and optional project keys (exp1-project-*).
 * Returns an array of rich-text strings.
 */
function parsePoints(prefix, extras) {
  const pts = [];
  for (let i = 1; i <= 10; i++) {
    const val = raw[`${prefix}-point${i}`];
    if (!val) break;
    pts.push(rich(`${prefix}-point${i}`));
  }
  if (extras) {
    for (const k of extras) {
      if (raw[k]) pts.push(rich(k));
    }
  }
  return pts;
}

// ─── build JSON ───────────────────────────────────────────────────────────────

const data = {

  lang: locale,

  name   : plain('name'),
  tagline: plain('tagline'),

  // ── Section titles ──────────────────────────────────────────────────────────
  titles: {
    contact    : plain('contact-title'),
    profile    : plain('profile-title'),
    skills     : plain('skills-title'),
    experiences: plain('experiences-title'),
    formation  : plain('formation-title'),
    languages  : plain('languages-title'),
    interests  : plain('interests-title'),
  },

  // ── Contact ─────────────────────────────────────────────────────────────────
  contact: [
    parseContactItem('contact-phone', 'Tel'),
    parseContactItem('contact-email', 'Email'),
    parseContactItem('contact-linkedin', 'LinkedIn'),
    parseContactItem('contact-github', 'GitHub'),
    // CV en ligne — URL built at compile time via --input cv-url=...
  ].filter(Boolean),

  cv_label: plain('contact-cv'),

  // ── Profile ─────────────────────────────────────────────────────────────────
  profile: plain('profile-desc'),

  // ── Skills ──────────────────────────────────────────────────────────────────
  skills: parseSkills(),

  // ── Experiences ─────────────────────────────────────────────────────────────
  experiences: [
    // ── 1. Fractional CTO (2022-2025) ──────────────────────────────────────
    {
      title   : plain('exp-fractional-title'),
      subtitle: plain('exp-fractional-subtitle'),
      type    : 'fractional',
      opensource: {
        heading: plain('exp-fractional-opensource-heading'),
        items: [
          {
            title: plain('exp-fractional-opensource-stimm-title'),
            stack: plain('exp-fractional-opensource-stimm-stack'),
            link : plain('exp-fractional-opensource-stimm-link'),
            desc : plain('exp-fractional-opensource-stimm'),
          },
          {
            title: plain('exp-fractional-opensource-n8n-title'),
            stack: plain('exp-fractional-opensource-n8n-stack'),
            link : plain('exp-fractional-opensource-n8n-link'),
            desc : plain('exp-fractional-opensource-n8n'),
          },
        ],
      },
      missions: {
        heading: plain('exp-fractional-missions-heading'),
        items: [
          {
            title : plain('exp1-title'),
            sector: plain('exp1-sector'),
            points: parsePoints('exp1', ['exp1-project-sarae']),
          },
          {
            title : plain('exp2-title'),
            sector: plain('exp2-sector'),
            points: parsePoints('exp2', ['exp2-project-exalbot']),
          },
        ],
      },
    },

    // ── 2. CTO Leni (2019-2022) ────────────────────────────────────────────
    {
      title : plain('exp3-title'),
      sector: plain('exp3-sector'),
      type  : 'simple',
      points: parsePoints('exp3', ['exp3-project-appkiosk']),
    },

    // ── 3. Lead Dev Freelance (2007-2019) ──────────────────────────────────
    {
      title : plain('exp4-title'),
      sector: plain('exp4-sectors'),
      type  : 'simple',
      points: parsePoints('exp4', [
        'exp4-tech',
        'exp4-project-digitec',
        'exp4-project-serious',
        'exp4-project-luxury',
      ]),
    },
  ],

  // ── Formation ───────────────────────────────────────────────────────────────
  formation: [
    plain('formation-bts'),
    plain('formation-autodidacte'),
  ].filter(Boolean),

  // ── Languages ───────────────────────────────────────────────────────────────
  languages: ['lang-fr', 'lang-en']
    .map(k => plain(k))
    .filter(Boolean),

  // ── Interests ───────────────────────────────────────────────────────────────
  interests: [1, 2, 3]
    .map(i => rich(`interest-${i}`))
    .filter(Boolean),
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
console.log(`[preprocess] ${locale} → ${path.relative(process.cwd(), out)}`);
