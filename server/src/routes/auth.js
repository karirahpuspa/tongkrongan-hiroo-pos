import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { COOKIE_NAME, cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler, fail, ok } from '../utils/response.js';

const router = Router();

// Hash tiruan agar waktu respons sama baik username ada maupun tidak
const DUMMY_HASH = bcrypt.hashSync('hash-tiruan-hiroo', 10);

const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role });

// POST /api/auth/login  { username, password }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      return fail(res, 400, 'Username dan kata sandi wajib diisi.');
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.password_hash, u.is_active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = ? LIMIT 1`,
      [username]
    );
    const user = rows[0];
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      return fail(res, 401, 'Username atau kata sandi salah.');
    }
    if (!user.is_active) {
      return fail(
        res,
        403,
        'Akun ini dinonaktifkan oleh Owner. Hubungi Owner untuk mengaktifkan kembali.'
      );
    }

    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    return ok(res, publicUser(user));
  })
);

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
  return ok(res, null);
});

// GET /api/auth/me — cek sesi; ambil ulang dari DB agar akun nonaktif langsung tertolak
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.is_active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return fail(res, 401, 'Akun tidak aktif.');
    }
    return ok(res, publicUser(user));
  })
);

export default router;
