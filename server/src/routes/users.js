import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, fail, ok } from '../utils/response.js';

const router = Router();

// Seluruh rute manajemen pengguna hanya dapat diakses oleh Owner yang sudah login
router.use(requireAuth, requireRole('owner'));

const formatUser = (row) => ({
  id: String(row.id),
  name: row.name,
  username: row.username,
  role: row.role,
  is_active: Boolean(row.is_active),
  created_at: row.created_at,
});

// GET /api/users — Mengambil daftar seluruh pengguna (password_hash TIDAK pernah disertakan)
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.is_active, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.id ASC`
    );
    return ok(res, rows.map(formatUser));
  })
);

// POST /api/users — Membuat akun pengguna baru (full_name/name, username, password, role)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || req.body?.full_name || '').trim();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const role = String(req.body?.role || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name) {
      return fail(res, 400, 'Nama lengkap wajib diisi.');
    }
    if (!username) {
      return fail(res, 400, 'Username wajib diisi.');
    }
    if (!['owner', 'cashier'].includes(role)) {
      return fail(res, 400, 'Peran (role) harus owner atau cashier.');
    }
    if (!password || password.length < 4) {
      return fail(res, 400, 'Kata sandi minimal 4 karakter.');
    }

    // Validasi keunikan username
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1',
      [username]
    );
    if (existing.length > 0) {
      return fail(res, 400, `Username "${username}" sudah digunakan. Silakan pilih username lain.`);
    }

    // Ambil role_id dari tabel roles
    const [roleRows] = await pool.query(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      [role]
    );
    if (roleRows.length === 0) {
      return fail(res, 400, 'Peran (role) tidak valid dalam sistem.');
    }
    const roleId = roleRows[0].id;

    // Hash kata sandi menggunakan bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (role_id, name, username, password_hash, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [roleId, name, username, passwordHash]
    );

    const [newRows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.is_active, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [result.insertId]
    );

    return ok(res, formatUser(newRows[0]), 201);
  })
);

// PUT /api/users/:id atau PATCH /api/users/:id — Mengubah data akun / status aktif / reset password
const updateUserHandler = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId || Number.isNaN(userId)) {
    return fail(res, 400, 'ID pengguna tidak valid.');
  }

  const [existingRows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.is_active, u.role_id, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  const existing = existingRows[0];
  if (!existing) {
    return fail(res, 404, 'Pengguna tidak ditemukan.');
  }

  // Proteksi akun Owner yang sedang login
  const isSelf = Number(req.user?.id) === userId;
  if (isSelf) {
    if (req.body?.is_active !== undefined && !req.body.is_active) {
      return fail(res, 400, 'Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }
    if (req.body?.role && req.body.role !== 'owner') {
      return fail(res, 400, 'Anda tidak dapat mengubah peran akun Anda sendiri.');
    }
  }

  const updates = [];
  const params = [];

  // Perubahan nama
  if (req.body?.name !== undefined || req.body?.full_name !== undefined) {
    const name = String(req.body.name || req.body.full_name || '').trim();
    if (!name) return fail(res, 400, 'Nama lengkap wajib diisi.');
    updates.push('name = ?');
    params.push(name);
  }

  // Perubahan username
  if (req.body?.username !== undefined) {
    const username = String(req.body.username).trim().toLowerCase();
    if (!username) return fail(res, 400, 'Username wajib diisi.');
    if (username !== existing.username.toLowerCase()) {
      const [dup] = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = ? AND id != ? LIMIT 1',
        [username, userId]
      );
      if (dup.length > 0) {
        return fail(res, 400, `Username "${username}" sudah digunakan oleh akun lain.`);
      }
      updates.push('username = ?');
      params.push(username);
    }
  }

  // Perubahan role
  if (req.body?.role !== undefined) {
    const role = String(req.body.role).trim().toLowerCase();
    if (!['owner', 'cashier'].includes(role)) {
      return fail(res, 400, 'Peran (role) harus owner atau cashier.');
    }
    if (role !== existing.role) {
      const [roleRows] = await pool.query(
        'SELECT id FROM roles WHERE name = ? LIMIT 1',
        [role]
      );
      if (roleRows.length === 0) {
        return fail(res, 400, 'Peran tidak ditemukan dalam sistem.');
      }
      updates.push('role_id = ?');
      params.push(roleRows[0].id);
    }
  }

  // Perubahan status aktif
  if (req.body?.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(Boolean(req.body.is_active));
  }

  // Perubahan kata sandi opsional
  if (req.body?.password) {
    const password = String(req.body.password);
    if (password.length < 4) {
      return fail(res, 400, 'Kata sandi minimal 4 karakter.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (updates.length === 0) {
    return fail(res, 400, 'Tidak ada perubahan data yang dikirimkan.');
  }

  params.push(userId);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  const [updatedRows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.is_active, u.created_at, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  return ok(res, formatUser(updatedRows[0]));
});

router.put('/:id', updateUserHandler);
router.patch('/:id', updateUserHandler);

// PATCH /api/users/:id/reset-password — Reset kata sandi pengguna
router.patch(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return fail(res, 400, 'ID pengguna tidak valid.');
    }

    const [existingRows] = await pool.query(
      'SELECT id, username FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (existingRows.length === 0) {
      return fail(res, 404, 'Pengguna tidak ditemukan.');
    }

    const password = String(req.body?.password || req.body?.newPassword || '');
    if (!password || password.length < 4) {
      return fail(res, 400, 'Kata sandi baru minimal 4 karakter.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    return ok(res, { message: `Kata sandi akun "${existingRows[0].username}" berhasil direset.` });
  })
);

// DELETE /api/users/:id — Hapus akun jika didukung skema & tidak memiliki relasi
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId || Number.isNaN(userId)) {
      return fail(res, 400, 'ID pengguna tidak valid.');
    }

    if (Number(req.user?.id) === userId) {
      return fail(res, 400, 'Anda tidak dapat menghapus akun Anda sendiri.');
    }

    const [existingRows] = await pool.query(
      'SELECT id, name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (existingRows.length === 0) {
      return fail(res, 404, 'Pengguna tidak ditemukan.');
    }

    // Periksa relasi di shifts dan orders
    const [shiftRefs] = await pool.query(
      'SELECT COUNT(*) AS total FROM shifts WHERE cashier_id = ? OR closed_by = ?',
      [userId, userId]
    );
    const [orderRefs] = await pool.query(
      'SELECT COUNT(*) AS total FROM orders WHERE cashier_id = ? OR cancelled_by = ?',
      [userId, userId]
    );

    if ((shiftRefs[0]?.total || 0) > 0 || (orderRefs[0]?.total || 0) > 0) {
      return fail(
        res,
        400,
        'Akun tidak dapat dihapus karena memiliki riwayat shift/pesanan. Silakan nonaktifkan akun ini.'
      );
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    return ok(res, { message: `Akun "${existingRows[0].name}" berhasil dihapus.` });
  })
);

export default router;
