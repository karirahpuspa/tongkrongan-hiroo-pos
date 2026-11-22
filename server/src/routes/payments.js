import { Router } from 'express';

import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok, fail } from '../utils/response.js';

const router = Router();

// Memproses pembayaran pesanan
router.post(
  '/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.orderId);
    const { method, amountPaid } = req.body;

    // Validasi ID pesanan
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, 'ID pesanan tidak valid.');
    }

    // Validasi metode pembayaran
    if (!['cash', 'qris'].includes(method)) {
      return fail(res, 400, 'Metode pembayaran tidak valid.');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Mengambil pesanan dan mengunci data selama transaksi
      const [orders] = await connection.query(
        `SELECT id, cashier_id, shift_id, total, status
         FROM orders
         WHERE id = ?
         FOR UPDATE`,
        [orderId]
      );

      const order = orders[0];

      if (!order) {
        await connection.rollback();
        return fail(res, 404, 'Pesanan tidak ditemukan.');
      }

      // Kasir hanya boleh membayar pesanan pada shift miliknya
      if (req.user.role === 'cashier') {
        const [shifts] = await connection.query(
          `SELECT cashier_id
           FROM shifts
           WHERE id = ?`,
          [order.shift_id]
        );

        if (
          !shifts[0] ||
          Number(shifts[0].cashier_id) !== Number(req.user.id)
        ) {
          await connection.rollback();
          return fail(res, 403, 'Pesanan bukan milik shift kamu.');
        }
      }

      // Pesanan harus menunggu pembayaran
      if (order.status !== 'pending_payment') {
        await connection.rollback();
        return fail(res, 409, 'Pesanan tidak dapat dibayar.');
      }

      // Memastikan pembayaran belum tercatat
      const [existingPayments] = await connection.query(
        'SELECT id FROM payments WHERE order_id = ?',
        [orderId]
      );

      if (existingPayments.length > 0) {
        await connection.rollback();
        return fail(res, 409, 'Pembayaran pesanan sudah tercatat.');
      }

      const total = Number(order.total);
      let paidAmount;
      let changeAmount;

      if (method === 'cash') {
        paidAmount = Number(amountPaid);

        if (
          !Number.isFinite(paidAmount) ||
          paidAmount < total
        ) {
          await connection.rollback();
          return fail(
            res,
            400,
            'Nominal pembayaran tunai kurang dari total pesanan.'
          );
        }

        changeAmount = paidAmount - total;
      } else {
        // Pembayaran QRIS harus sesuai total pesanan
        paidAmount = total;
        changeAmount = 0;
      }

      // Menyimpan pembayaran
      await connection.query(
        `INSERT INTO payments
          (order_id, method, status, amount_paid, change_amount, paid_at)
         VALUES (?, ?, 'paid', ?, ?, NOW())`,
        [orderId, method, paidAmount, changeAmount]
      );

      // Mengubah status pesanan setelah pembayaran berhasil
      await connection.query(
        `UPDATE orders
         SET status = 'processing'
         WHERE id = ?`,
        [orderId]
      );

      await connection.commit();

      return ok(res, {
        orderId,
        method,
        total,
        amountPaid: paidAmount,
        changeAmount,
        paymentStatus: 'paid',
        orderStatus: 'processing',
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
