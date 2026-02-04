const http = require('http');
const fs = require('fs');
const path = require('path');

// Serve files from dist/web if it exists, otherwise from root
const SERVE_DIR = fs.existsSync(path.join(__dirname, 'dist/web'))
  ? path.join(__dirname, 'dist/web')
  : __dirname;

console.log(`🌐 Serving files from: ${SERVE_DIR}`);

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
  // Parse URL and remove query string
  let urlPath = req.url.split('?')[0];
  
  // Remove /cv prefix if present (for compatibility with built files)
  urlPath = urlPath.replace(/^\/cv/, '');
  
  // Handle root request with language redirection
  if (urlPath === '/' || urlPath === '') {
    const acceptLanguage = req.headers['accept-language'];
    const lang = getPreferredLanguage(acceptLanguage);
    urlPath = lang === 'fr' ? '/index.html' : `/index-${lang}.html`;
  }

  // Build file path relative to SERVE_DIR
  let filePath = path.join(SERVE_DIR, urlPath);
  
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