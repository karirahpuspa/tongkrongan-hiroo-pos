import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tongkrongan_hiroo_pos',
  },
};

export function assertEnv() {
  if (!env.jwtSecret || env.jwtSecret.length < 32 || env.jwtSecret.startsWith('GANTI_')) {
    throw new Error('JWT_SECRET belum diisi dengan benar di server/.env (minimal 32 karakter acak).');
  }
}
