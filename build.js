const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

// Sans argument : le CV générique publié. Avec arguments : les fichiers HTML donnés, PDF à côté.
const DEFAULT = [
  ['site/index.html', 'site/cv-fr.pdf'],
  ['site/index-en.html', 'site/cv-en.pdf'],
];

const MM = 96 / 25.4;
const A4 = 297 * MM;

// Les PDF sont calibrés sur le rendu Arial d'Edge ou Chrome sous Windows : ils se génèrent en local.
const executablePath = [
  process.env.CV_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

// Place libre en bas de chaque .page, en mm. Négatif : le contenu déborde.
function freeSpace(pages, a4) {
  return pages.map((el) => {
    const top = el.getBoundingClientRect().top;
    const padding = parseFloat(getComputedStyle(el).paddingBottom);
    const bottom = Math.max(top, ...[...el.children].map((child) => child.getBoundingClientRect().bottom));
    return top + a4 - padding - bottom;
  });
}

async function render(browser, source, output) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`file:///${source.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const free = await page.$$eval('.page', freeSpace, A4);
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await page.close();
  return free.map((px) => Math.floor(px / MM));
}

async function main() {
  const args = process.argv.slice(2);
  const jobs = args.length
    ? args.map((file) => [path.resolve(file), path.resolve(file).replace(/\.html?$/i, '.pdf')])
    : DEFAULT.map(([source, output]) => [path.join(__dirname, source), path.join(__dirname, output)]);

  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [source, output] of jobs) {
      const free = await render(browser, source, output);
      const failed = free.length === 0 || free.some((mm) => mm < 0);
      if (failed) process.exitCode = 1;
      const report = free.length
        ? free.map((mm, i) => `page ${i + 1} : ${mm < 0 ? `déborde de ${-mm} mm` : `${mm} mm libres`}`).join(' · ')
        : 'aucun élément .page';
      console.log(`${failed ? 'ÉCHEC' : 'OK   '} ${path.relative(process.cwd(), output)} · ${report}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
