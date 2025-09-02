const puppeteer = require('puppeteer');
const fs = require('fs');

// Get command line arguments
const htmlFile = process.argv[2] || 'index.html';
const cssFile = process.argv[3] || 'style.css';
const output = process.argv[4] || 'output.pdf';
const safeMode = process.argv[5] ? process.argv[5].toLowerCase() === 'true' : false;

// Read HTML and CSS
let html = fs.readFileSync(htmlFile, 'utf8');
const css = fs.readFileSync(cssFile, 'utf8');

// In safe mode, escape special characters in CSS
const safeCss = safeMode ? escapeSpecialChars(css) : css;

// Remove existing <link rel="stylesheet" ...> and inject CSS inline
html = html.replace(/<link rel="stylesheet" href=".*?">/, `<style>${safeCss}</style>`);

// Function to escape special characters
function escapeSpecialChars(str) {
  return str.replace(/[&<>"']/g, function (char) {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: output, format: 'A4', printBackground: true });
  await browser.close();
  console.log(`PDF generated as ${output} using ${cssFile} ${safeMode ? 'with safe mode' : ''}`);
})();