// Membuat database + tabel dari database/schema.sql, mengisi data awal
// (database/seed.sql), lalu membuat akun owner/kasir dengan password bcrypt.
// PERINGATAN: schema.sql membuat tabel baru; skrip ini menghapus database lama
// tongkrongan_hiroo_pos (DROP) supaya bisa diulang dari nol saat pengembangan.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(here, '../../database');
const DB_NAME = process.env.DB_NAME || 'tongkrongan_hiroo_pos';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed dinonaktifkan saat NODE_ENV=production.');
  process.exit(1);
}

const ownerPw = process.env.SEED_OWNER_PASSWORD || 'owner123';
const cashierPw = process.env.SEED_CASHIER_PASSWORD || 'kasir123';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

try {
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await conn.query(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf8'));
  await conn.query(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf8'));

  const [roles] = await conn.query('SELECT id, name FROM roles');
  const roleId = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  const users = [
    ['owner', 'Faiz Alfianto', 'faiz', ownerPw],
    ['owner', 'Nadia Putri', 'nadia', ownerPw],
    ['cashier', 'Siti Rahma', 'siti', cashierPw],
    ['cashier', 'Budi Santoso', 'budi', cashierPw],
  ];
  for (const [role, name, username, pw] of users) {
    await conn.query(
      'INSERT INTO users (role_id, name, username, password_hash, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [roleId[role], name, username, await bcrypt.hash(pw, 10)]
    );
  }
  console.log(`Seed selesai: database ${DB_NAME}, ${users.length} akun, menu awal terisi.`);
} finally {
  await conn.end();
}
