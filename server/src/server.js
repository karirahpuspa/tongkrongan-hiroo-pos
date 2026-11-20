import { assertEnv, env } from './config/env.js';
import { checkDb } from './config/db.js';
import app from './app.js';

assertEnv();

try {
  await checkDb();
  console.log('Koneksi MySQL berhasil.');
} catch (err) {
  console.error('Koneksi MySQL GAGAL:', err.message);
  console.error('Periksa DB_* di server/.env dan pastikan `npm run seed` sudah dijalankan.');
  process.exit(1);
}

app.listen(env.port, () => {
  console.log(`Server Hiroo POS berjalan di http://localhost:${env.port}`);
});
