import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE/DATETIME dikembalikan sebagai string, bukan objek Date
  decimalNumbers: true, // DECIMAL dikembalikan sebagai angka
});

export async function checkDb() {
  const [rows] = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}
