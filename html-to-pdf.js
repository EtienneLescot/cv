const puppeteer = require('puppeteer');
const fs = require('fs');

const htmlFile = process.argv[2] || 'index.html';
const cssFile = process.argv[3] || 'style.css';
const output = process.argv[4] || 'output.pdf';

// Read HTML and CSS
let html = fs.readFileSync(htmlFile, 'utf8');
const css = fs.readFileSync(cssFile, 'utf8');

// Remove existing <link rel="stylesheet" ...> and inject CSS inline
html = html.replace(/<link rel="stylesheet" href=".*?">/, `<style>${css}</style>`);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: output, format: 'A4', printBackground: true });
  await browser.close();
  console.log(`PDF generated as ${output} using ${cssFile}`);
})();