import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, fail, ok } from '../utils/response.js';

const router = Router();

// Konfigurasi direktori penyimpanan upload foto menu
const uploadDir = path.resolve('uploads/menus');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `menu-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format foto harus JPG, PNG, atau WEBP.'));
    }
  },
});

// Helper untuk menyimpan string base64 jika klien mengirim langsung dalam payload
function saveBase64Image(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  const matches = dataUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches) return dataUrl;
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `menu-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/menus/${filename}`;
}

const illustrationKeyFromCategory = (cat) => {
  switch (cat) {
    case 'Kopi':
      return 'kopi_susu';
    case 'Non-Kopi':
      return 'lemon_tea';
    case 'Cemilan':
      return 'pisang_goreng';
    case 'Makanan':
      return 'mie_goreng';
    default:
      return 'kopi_susu';
  }
};

const formatMenu = (row) => ({
  id: String(row.id),
  code: row.code,
  name: row.name,
  category: row.category,
  price: Number(row.price),
  serving_label: row.serving_label || 'Porsi Reguler',
  illustration_key: illustrationKeyFromCategory(row.category),
  image_url: row.image_url || null,
  is_available: Boolean(row.is_available),
  is_active: Boolean(row.is_active),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// POST /api/menus/upload — Unggah file foto menu (khusus Owner)
router.post(
  '/upload',
  requireAuth,
  requireRole('owner'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return fail(res, 400, 'File gambar tidak ditemukan.');
    }
    const publicUrl = `/uploads/menus/${req.file.filename}`;
    return ok(res, { url: publicUrl }, 201);
  })
);

// GET /api/menus — Daftar semua menu
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isOwner = req.user?.role === 'owner';
    const queryAll = req.query.all === 'true' || isOwner;

    const sql = queryAll
      ? `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active, created_at, updated_at
         FROM menus ORDER BY category ASC, code ASC, id ASC`
      : `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active, created_at, updated_at
         FROM menus WHERE is_active = 1 ORDER BY category ASC, code ASC, id ASC`;

    const [rows] = await pool.query(sql);
    return ok(res, rows.map(formatMenu));
  })
);

// POST /api/menus — Tambah menu baru (khusus Owner)
router.post(
  '/',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const category = String(req.body?.category ?? '').trim();
    const price = Number(req.body?.price);
    const serving_label = String(req.body?.serving_label ?? '').trim() || 'Porsi Reguler';
    let code = String(req.body?.code ?? '').trim().toUpperCase();
    let image_url = req.body?.image_url ? String(req.body.image_url) : null;

    if (!name) {
      return fail(res, 400, 'Nama menu wajib diisi.');
    }

    const validCategories = ['Kopi', 'Non-Kopi', 'Makanan', 'Cemilan'];
    if (!validCategories.includes(category)) {
      return fail(res, 400, 'Kategori menu tidak valid.');
    }

    if (!Number.isFinite(price) || price <= 0) {
      return fail(res, 400, 'Harga menu harus lebih besar dari Rp 0.');
    }

    // Generate kode otomatis jika kosong
    if (!code) {
      const prefixMap = {
        Kopi: 'KOP',
        'Non-Kopi': 'NON',
        Cemilan: 'CEM',
        Makanan: 'MAK',
      };
      const prefix = prefixMap[category] || 'MNU';
      const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM menus WHERE category = ?',
        [category]
      );
      code = `${prefix}-${String((countRows[0]?.total || 0) + 1).padStart(2, '0')}`;
    }

    // Periksa duplikasi kode
    const [existingCode] = await pool.query(
      'SELECT id FROM menus WHERE code = ? LIMIT 1',
      [code]
    );
    if (existingCode.length > 0) {
      return fail(res, 400, `Kode menu "${code}" sudah digunakan. Gunakan kode lain.`);
    }

    // Jika image_url berupa base64, simpan ke berkas
    if (image_url && image_url.startsWith('data:image/')) {
      image_url = saveBase64Image(image_url);
    }

    const [result] = await pool.query(
      `INSERT INTO menus (code, name, category, price, serving_label, image_url, is_available, is_active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
      [code, name, category, Math.round(price), serving_label, image_url]
    );

    const [newRows] = await pool.query(
      `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active, created_at, updated_at
       FROM menus WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return ok(res, formatMenu(newRows[0]), 201);
  })
);

// PUT /api/menus/:id — Ubah data menu lengkap (khusus Owner)
router.put(
  '/:id',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const menuId = Number(req.params.id);
    if (!menuId || Number.isNaN(menuId)) {
      return fail(res, 400, 'ID menu tidak valid.');
    }

    const [existingRows] = await pool.query(
      `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active
       FROM menus WHERE id = ? LIMIT 1`,
      [menuId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return fail(res, 404, 'Menu tidak ditemukan.');
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    const category = req.body?.category !== undefined ? String(req.body.category).trim() : existing.category;
    const price = req.body?.price !== undefined ? Number(req.body.price) : Number(existing.price);
    const serving_label = req.body?.serving_label !== undefined ? String(req.body.serving_label).trim() : existing.serving_label;
    const code = req.body?.code !== undefined ? String(req.body.code).trim().toUpperCase() : existing.code;
    let image_url = req.body?.image_url !== undefined ? req.body.image_url : existing.image_url;

    if (!name) {
      return fail(res, 400, 'Nama menu wajib diisi.');
    }

    const validCategories = ['Kopi', 'Non-Kopi', 'Makanan', 'Cemilan'];
    if (!validCategories.includes(category)) {
      return fail(res, 400, 'Kategori menu tidak valid.');
    }

    if (!Number.isFinite(price) || price <= 0) {
      return fail(res, 400, 'Harga menu harus lebih besar dari Rp 0.');
    }

    // Periksa keunikan kode jika berubah
    if (code !== existing.code) {
      const [duplicate] = await pool.query(
        'SELECT id FROM menus WHERE code = ? AND id != ? LIMIT 1',
        [code, menuId]
      );
      if (duplicate.length > 0) {
        return fail(res, 400, `Kode menu "${code}" sudah digunakan oleh menu lain.`);
      }
    }

    if (image_url && typeof image_url === 'string' && image_url.startsWith('data:image/')) {
      image_url = saveBase64Image(image_url);
    }

    const is_available = req.body?.is_available !== undefined ? Boolean(req.body.is_available) : existing.is_available;
    const is_active = req.body?.is_active !== undefined ? Boolean(req.body.is_active) : existing.is_active;

    await pool.query(
      `UPDATE menus
       SET code = ?, name = ?, category = ?, price = ?, serving_label = ?, image_url = ?, is_available = ?, is_active = ?
       WHERE id = ?`,
      [code, name, category, Math.round(price), serving_label, image_url, is_available, is_active, menuId]
    );

    const [updatedRows] = await pool.query(
      `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active, created_at, updated_at
       FROM menus WHERE id = ? LIMIT 1`,
      [menuId]
    );

    return ok(res, formatMenu(updatedRows[0]));
  })
);

// PATCH /api/menus/:id — Ubah sebagian atribut / toggle is_available atau is_active (khusus Owner)
router.patch(
  '/:id',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const menuId = Number(req.params.id);
    if (!menuId || Number.isNaN(menuId)) {
      return fail(res, 400, 'ID menu tidak valid.');
    }

    const [existingRows] = await pool.query(
      `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active
       FROM menus WHERE id = ? LIMIT 1`,
      [menuId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return fail(res, 404, 'Menu tidak ditemukan.');
    }

    const updates = [];
    const params = [];

    if (req.body?.is_available !== undefined) {
      updates.push('is_available = ?');
      params.push(Boolean(req.body.is_available));
    }

    if (req.body?.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(Boolean(req.body.is_active));
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return fail(res, 400, 'Nama menu wajib diisi.');
      updates.push('name = ?');
      params.push(name);
    }

    if (req.body?.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price <= 0) {
        return fail(res, 400, 'Harga menu harus lebih besar dari Rp 0.');
      }
      updates.push('price = ?');
      params.push(Math.round(price));
    }

    if (req.body?.category !== undefined) {
      const category = String(req.body.category).trim();
      const validCategories = ['Kopi', 'Non-Kopi', 'Makanan', 'Cemilan'];
      if (!validCategories.includes(category)) {
        return fail(res, 400, 'Kategori menu tidak valid.');
      }
      updates.push('category = ?');
      params.push(category);
    }

    if (req.body?.serving_label !== undefined) {
      updates.push('serving_label = ?');
      params.push(String(req.body.serving_label).trim());
    }

    if (req.body?.image_url !== undefined) {
      let image_url = req.body.image_url;
      if (image_url && typeof image_url === 'string' && image_url.startsWith('data:image/')) {
        image_url = saveBase64Image(image_url);
      }
      updates.push('image_url = ?');
      params.push(image_url);
    }

    if (req.body?.code !== undefined) {
      const code = String(req.body.code).trim().toUpperCase();
      if (code && code !== existing.code) {
        const [duplicate] = await pool.query(
          'SELECT id FROM menus WHERE code = ? AND id != ? LIMIT 1',
          [code, menuId]
        );
        if (duplicate.length > 0) {
          return fail(res, 400, `Kode menu "${code}" sudah digunakan.`);
        }
        updates.push('code = ?');
        params.push(code);
      }
    }

    if (updates.length === 0) {
      return fail(res, 400, 'Tidak ada perubahan yang dikirimkan.');
    }

    params.push(menuId);
    await pool.query(`UPDATE menus SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updatedRows] = await pool.query(
      `SELECT id, code, name, category, price, serving_label, image_url, is_available, is_active, created_at, updated_at
       FROM menus WHERE id = ? LIMIT 1`,
      [menuId]
    );

    return ok(res, formatMenu(updatedRows[0]));
  })
);

// DELETE /api/menus/:id — Hapus menu jika didukung skema (belum pernah ada di order_items)
router.delete(
  '/:id',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const menuId = Number(req.params.id);
    if (!menuId || Number.isNaN(menuId)) {
      return fail(res, 400, 'ID menu tidak valid.');
    }

    const [existingRows] = await pool.query(
      'SELECT id, name FROM menus WHERE id = ? LIMIT 1',
      [menuId]
    );
    if (existingRows.length === 0) {
      return fail(res, 404, 'Menu tidak ditemukan.');
    }

    // Periksa apakah menu sudah terikat dengan order_items
    const [orderRefs] = await pool.query(
      'SELECT COUNT(*) AS count FROM order_items WHERE menu_id = ?',
      [menuId]
    );

    if (orderRefs[0]?.count > 0) {
      return fail(
        res,
        400,
        'Menu tidak dapat dihapus karena sudah memiliki riwayat pesanan. Silakan nonaktifkan menu ini agar tidak muncul lagi pada kasir.'
      );
    }

    await pool.query('DELETE FROM menus WHERE id = ?', [menuId]);
    return ok(res, { message: `Menu "${existingRows[0].name}" berhasil dihapus.` });
  })
);

export default router;
