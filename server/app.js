import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export function createApp({ db, adminPassphrase = process.env.ADMIN_PASSPHRASE || 'score-keeper' } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  if (db) {
    app.use('/api', createRouter({ db, adminPassphrase }));
  }

  const distPath = path.join(projectRoot, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'), (error) => {
      if (error) next();
    });
  });

  return app;
}
