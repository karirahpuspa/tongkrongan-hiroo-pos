import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { fail } from './utils/response.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/api', routes);

app.use('/api', (_req, res) => fail(res, 404, 'Endpoint tidak ditemukan.'));

// Penanganan error terpusat
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Terjadi kesalahan pada server.' : err.message;
  fail(res, status, message);
});

export default app;
