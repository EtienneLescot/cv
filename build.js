const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const PAGES = [
  ['index.html', 'cv-fr.pdf'],
  ['index-en.html', 'cv-en.pdf'],
];

// Les PDF sont calibres sur le rendu Arial d'Edge ou Chrome sous Windows : ils se generent en local.
const executablePath = [
  process.env.CV_BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

async function main() {
  const site = path.join(__dirname, 'site');
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [source, output] of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`file:///${path.join(site, source).replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: path.join(site, output),
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        outline: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await page.close();
      console.log(output);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
