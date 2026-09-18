/**
 * ==========================================================================
 * APEX FITNESS CLUB — NODE.JS DEVELOPMENT SERVER & PROXY
 * High-Performance Static Server + Reverse Proxy to Python Flask API
 * Zero External Dependencies (Native Node.js HTTP/FS/Path)
 * ==========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const FLASK_API_HOST = '127.0.0.1';
const FLASK_API_PORT = 5000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 1. Proxy API & Uploads requests to Python Flask backend (Port 5000)
  if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) {
    const proxyReq = http.request({
      host: FLASK_API_HOST,
      port: FLASK_API_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error(`[Node Proxy Error] Cannot reach Flask API on port ${FLASK_API_PORT}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Backend server unavailable. Please ensure Python Flask (python run.py) is running on port 5000.'
      }));
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  // 2. Clean URL rewrites for Frontend routes
  if (pathname === '/') {
    pathname = '/index.html';
  } else if (pathname === '/login') {
    pathname = '/login.html';
  } else if (pathname === '/admin') {
    pathname = '/admin-dashboard.html';
  } else if (pathname === '/member') {
    pathname = '/member-dashboard.html';
  }

  const filePath = path.join(FRONTEND_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Resource Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`
========================================================================
   APEX FITNESS CLUB — NODE.JS DEVELOPMENT SERVER
========================================================================
   Frontend Server:  http://localhost:${PORT}
   API Proxy:        http://127.0.0.1:${FLASK_API_PORT}/api
   Landing Page:     http://localhost:${PORT}/
   Login Portal:     http://localhost:${PORT}/login
   Admin Console:    http://localhost:${PORT}/admin
   Member Portal:    http://localhost:${PORT}/member
------------------------------------------------------------------------
   Node Version:     ${process.version}
========================================================================
`);
});
