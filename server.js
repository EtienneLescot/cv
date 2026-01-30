const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

const getPreferredLanguage = (acceptLanguage) => {
  if (!acceptLanguage) return 'fr';
  if (acceptLanguage.includes('fr')) return 'fr';
  if (acceptLanguage.includes('en')) return 'en';
  return 'fr'; // default fallback
};

const server = http.createServer((req, res) => {
  // (no special preview route; use `npm run build:pdf` to generate PDF-styled assets)

  let filePath = '.' + req.url;
  // strip query string to correctly resolve static files (e.g. style-pdf.css?v=...)
  let cleanPath = filePath.split('?')[0];
  if (cleanPath === './') {
    // Handle root request with language redirection
    const acceptLanguage = req.headers['accept-language'];
    const lang = getPreferredLanguage(acceptLanguage);

    if (lang === 'fr') {
      cleanPath = './index.html'; // French default
    } else {
      cleanPath = `./index-${lang}.html`;
    }
  }

  const ext = path.extname(cleanPath);
  const contentType = CONTENT_TYPES[ext] || 'text/plain';

  fs.readFile(cleanPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.code);
      }
    } else {
      // Set cache policy for static assets; disable long-term caching for CSS during development
      const cacheHeaders = {
        'Content-Type': contentType,
        'Cache-Control': ext === '.css' ? 'no-cache' : 'public, max-age=31536000, immutable'
      };

      res.writeHead(200, cacheHeaders);
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});