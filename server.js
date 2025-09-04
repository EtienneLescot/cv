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
  let filePath = '.' + req.url;
  if (filePath === './') {
    // Handle root request with language redirection
    const acceptLanguage = req.headers['accept-language'];
    const lang = getPreferredLanguage(acceptLanguage);

    if (lang === 'fr') {
      filePath = './index.html'; // French default
    } else {
      filePath = `./index-${lang}.html`;
    }
  }

  const ext = path.extname(filePath);
  const contentType = CONTENT_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.code);
      }
    } else {
      // Set efficient cache policy for static assets
      const cacheHeaders = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      };

      res.writeHead(200, cacheHeaders);
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});