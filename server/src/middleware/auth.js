import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';

export const COOKIE_NAME = 'hiroo_token';

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  };
}

export function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, env.jwtSecret, {
    expiresIn: '12h',
  });
}

// Wajib login. Mengisi req.user = { id, name, role }
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return fail(res, 401, 'Belum login.');
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    return fail(res, 401, 'Sesi berakhir. Silakan login kembali.');
  }
}

// Pembatasan role di server (bukan hanya di tampilan). Contoh: requireRole('owner')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'Akses ditolak.');
    }
    next();
  };
}
