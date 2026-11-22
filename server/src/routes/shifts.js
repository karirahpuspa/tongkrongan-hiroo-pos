import { Router } from 'express';

import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok, fail } from '../utils/response.js';

const router = Router();


// Memulai shift baru
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { openingCash } = req.body;

    // Validasi uang modal awal
    if (
      openingCash === undefined ||
      !Number.isFinite(Number(openingCash)) ||
      Number(openingCash) < 0
    ) {
      return fail(res, 400, 'Modal awal harus berupa angka minimal 0.');
    }

    // Cek apakah masih ada shift yang terbuka
    const [activeShifts] = await pool.query(
      "SELECT id FROM shifts WHERE status = 'open' LIMIT 1"
    );

    if (activeShifts.length > 0) {
      return fail(res, 409, 'Masih ada shift yang terbuka.');
    }

    // Membuat kode shift unik
    const shiftCode = `SH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Menyimpan shift baru ke database
    const [result] = await pool.query(
      `INSERT INTO shifts
        (shift_code, cashier_id, business_date, started_at, opening_cash, status)
       VALUES (?, ?, CURDATE(), NOW(), ?, 'open')`,
      [shiftCode, req.user.id, Number(openingCash)]
    );

    // Mengambil data shift yang baru dibuat
    const [rows] = await pool.query(
      `SELECT
        id,
        shift_code AS shiftCode,
        cashier_id AS cashierId,
        business_date AS businessDate,
        started_at AS startedAt,
        opening_cash AS openingCash,
        status
       FROM shifts
       WHERE id = ?`,
      [result.insertId]
    );

    return ok(res, rows[0], 201);
  })
);

// Menampilkan shift yang sedang aktif
router.get(
  '/active',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.shift_code AS shiftCode,
        s.cashier_id AS cashierId,
        u.name AS cashierName,
        s.business_date AS businessDate,
        s.started_at AS startedAt,
        s.opening_cash AS openingCash
      FROM shifts s
      JOIN users u ON u.id = s.cashier_id
      WHERE s.status = 'open'
      ORDER BY s.started_at DESC
      LIMIT 1
    `);

    return ok(res, rows[0] ?? null);
  })
);

// Menutup shift
router.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { actualCash, note } = req.body;

    // Validasi kas aktual
    if (
      actualCash === undefined ||
      !Number.isFinite(Number(actualCash)) ||
      Number(actualCash) < 0
    ) {
      return fail(res, 400, 'Kas aktual harus berupa angka minimal 0.');
    }

    // Ambil data shift
    const [shifts] = await pool.query(
      `SELECT id, cashier_id AS cashierId, opening_cash AS openingCash, status
       FROM shifts
       WHERE id = ?`,
      [id]
    );

    if (shifts.length === 0) {
      return fail(res, 404, 'Shift tidak ditemukan.');
    }

    const shift = shifts[0];

    if (shift.status !== 'open') {
      return fail(res, 409, 'Shift sudah ditutup.');
    }

    // Kasir hanya boleh menutup shift miliknya
    if (
      req.user.role === 'cashier' &&
      Number(shift.cashierId) !== Number(req.user.id)
    ) {
      return fail(res, 403, 'Kamu hanya boleh menutup shift milik sendiri.');
    }

    // Hitung total penjualan tunai dari pembayaran yang sudah lunas
    const [sales] = await pool.query(
      `SELECT COALESCE(SUM(p.amount_paid - p.change_amount), 0) AS cashSales
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.shift_id = ?
         AND p.method = 'cash'
         AND p.status = 'paid'`,
      [id]
    );

    const expectedCash =
      Number(shift.openingCash) + Number(sales[0].cashSales);

    const cash = Number(actualCash);
    const difference = cash - expectedCash;

    // Simpan hasil penutupan
    await pool.query(
      `UPDATE shifts
       SET ended_at = NOW(),
           expected_cash = ?,
           actual_cash = ?,
           difference = ?,
           status = 'closed',
           closed_by = ?,
           note = ?
       WHERE id = ?`,
      [
        expectedCash,
        cash,
        difference,
        req.user.id,
        note?.trim() || null,
        id,
      ]
    );

    return ok(res, {
      shiftId: Number(id),
      expectedCash,
      actualCash: cash,
      difference,
      status: 'closed',
    });
  })
);


/**
 * Menampilkan ringkasan shift
 * GET /api/shifts/:id/summary
 */
router.get(
  '/:id/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Ambil data shift
    const [shifts] = await pool.query(
      `SELECT
        id,
        cashier_id AS cashierId,
        opening_cash AS openingCash,
        status
       FROM shifts
       WHERE id = ?`,
      [id]
    );

    if (shifts.length === 0) {
      return fail(res, 404, 'Shift tidak ditemukan.');
    }

    const shift = shifts[0];

    // Kasir hanya boleh melihat ringkasan shift miliknya
    if (
      req.user.role === 'cashier' &&
      Number(shift.cashierId) !== Number(req.user.id)
    ) {
      return fail(res, 403, 'Kamu tidak memiliki akses ke shift ini.');
    }

    // Hitung transaksi berdasarkan metode pembayaran
    const [summary] = await pool.query(
      `SELECT
        COUNT(CASE WHEN p.status = 'paid' THEN 1 END) AS paidCount,
        COALESCE(SUM(
          CASE
            WHEN p.status = 'paid' AND p.method = 'cash'
            THEN p.amount_paid - p.change_amount
            ELSE 0
          END
        ), 0) AS cashSales,
        COALESCE(SUM(
          CASE
            WHEN p.status = 'paid' AND p.method = 'qris'
            THEN p.amount_paid
            ELSE 0
          END
        ), 0) AS qrisSales,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelledCount
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.shift_id = ?`,
      [id]
    );

    const data = summary[0];

    const openingCash = Number(shift.openingCash);
    const cashSales = Number(data.cashSales);
    const qrisSales = Number(data.qrisSales);

    return ok(res, {
      shiftId: Number(shift.id),
      status: shift.status,
      openingCash,
      cashSales,
      qrisSales,
      expectedCash: openingCash + cashSales,
      paidCount: Number(data.paidCount),
      cancelledCount: Number(data.cancelledCount),
    });
  })
);


/**
 * Melihat ringkasan shift
 * GET /api/shifts/:id/summary
 */
router.get(
  '/:id/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const shiftId = Number(req.params.id);

    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return fail(res, 400, 'ID shift tidak valid.');
    }

    const [rows] = await pool.query(
      `SELECT
        s.id,
        s.cashier_id AS cashierId,
        s.opening_cash AS openingCash,
        s.status,
        (
          SELECT COALESCE(SUM(p.amount_paid - p.change_amount), 0)
          FROM orders o
          JOIN payments p ON p.order_id = o.id
          WHERE o.shift_id = s.id
            AND p.method = 'cash'
            AND p.status = 'paid'
        ) AS cashSales,
        (
          SELECT COALESCE(SUM(p.amount_paid), 0)
          FROM orders o
          JOIN payments p ON p.order_id = o.id
          WHERE o.shift_id = s.id
            AND p.method = 'qris'
            AND p.status = 'paid'
        ) AS qrisSales,
        (
          SELECT COUNT(*)
          FROM orders o
          JOIN payments p ON p.order_id = o.id
          WHERE o.shift_id = s.id
            AND p.status = 'paid'
        ) AS paidOrderCount,
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.shift_id = s.id
            AND o.status = 'cancelled'
        ) AS cancelledOrderCount
      FROM shifts s
      WHERE s.id = ?`,
      [shiftId]
    );

    const shift = rows[0];

    if (!shift) {
      return fail(res, 404, 'Shift tidak ditemukan.');
    }

    // Kasir hanya boleh melihat ringkasan shift miliknya.
    if (
      req.user.role === 'cashier' &&
      Number(shift.cashierId) !== Number(req.user.id)
    ) {
      return fail(res, 403, 'Kamu tidak memiliki akses ke shift ini.');
    }

    const openingCash = Number(shift.openingCash);
    const cashSales = Number(shift.cashSales);
    const qrisSales = Number(shift.qrisSales);

    return ok(res, {
      id: shift.id,
      openingCash,
      cashSales,
      qrisSales,
      expectedCash: openingCash + cashSales,
      paidOrderCount: Number(shift.paidOrderCount),
      cancelledOrderCount: Number(shift.cancelledOrderCount),
      status: shift.status,
    });
  })
);


/**
 * Menutup shift
 * POST /api/shifts/:id/close
 */
router.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req, res) => {
    const shiftId = Number(req.params.id);
    const { actualCash, note = '' } = req.body;

    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      return fail(res, 400, 'ID shift tidak valid.');
    }

    if (
      actualCash === undefined ||
      !Number.isFinite(Number(actualCash)) ||
      Number(actualCash) < 0
    ) {
      return fail(res, 400, 'Uang kas aktual harus berupa angka minimal 0.');
    }

    if (typeof note !== 'string') {
      return fail(res, 400, 'Catatan harus berupa teks.');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [shifts] = await connection.query(
        `SELECT id, cashier_id, opening_cash, status
         FROM shifts
         WHERE id = ?
         FOR UPDATE`,
        [shiftId]
      );

      const shift = shifts[0];

      if (!shift) {
        await connection.rollback();
        return fail(res, 404, 'Shift tidak ditemukan.');
      }

      if (shift.status !== 'open') {
        await connection.rollback();
        return fail(res, 409, 'Shift ini sudah ditutup.');
      }

      // Kasir hanya boleh menutup shift miliknya.
      if (
        req.user.role === 'cashier' &&
        Number(shift.cashier_id) !== Number(req.user.id)
      ) {
        await connection.rollback();
        return fail(res, 403, 'Kamu tidak memiliki akses ke shift ini.');
      }

      // Owner yang menutup shift milik kasir lain wajib memberi catatan.
      if (
        req.user.role === 'owner' &&
        Number(shift.cashier_id) !== Number(req.user.id) &&
        !note.trim()
      ) {
        await connection.rollback();
        return fail(
          res,
          400,
          'Owner wajib mengisi catatan saat menutup shift kasir lain.'
        );
      }

      const [sales] = await connection.query(
        `SELECT COALESCE(
          SUM(p.amount_paid - p.change_amount), 0
        ) AS cashSales
        FROM orders o
        JOIN payments p ON p.order_id = o.id
        WHERE o.shift_id = ?
          AND p.method = 'cash'
          AND p.status = 'paid'`,
        [shiftId]
      );

      const openingCash = Number(shift.opening_cash);
      const cashSales = Number(sales[0].cashSales);
      const expectedCash = openingCash + cashSales;
      const countedCash = Number(actualCash);
      const difference = countedCash - expectedCash;

      await connection.query(
        `UPDATE shifts
         SET ended_at = NOW(),
             expected_cash = ?,
             actual_cash = ?,
             difference = ?,
             status = 'closed',
             closed_by = ?,
             note = ?
         WHERE id = ?`,
        [
          expectedCash,
          countedCash,
          difference,
          req.user.id,
          note.trim() || null,
          shiftId,
        ]
      );

      await connection.commit();

      return ok(res, {
        shiftId,
        openingCash,
        cashSales,
        expectedCash,
        actualCash: countedCash,
        difference,
        status: 'closed',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

export default router;
