
import { Router } from 'express';

import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok, fail } from '../utils/response.js';

const router = Router();

// Membuat pesanan baru
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      customerName,
      note = '',
      items,
      idempotencyKey,
    } = req.body;

    // Validasi data pesanan
    if (typeof customerName !== 'string' || !customerName.trim()) {
      return fail(res, 400, 'Nama pelanggan wajib diisi.');
    }

    if (typeof note !== 'string') {
      return fail(res, 400, 'Catatan pesanan tidak valid.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, 400, 'Keranjang pesanan masih kosong.');
    }

    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim()
    ) {
      return fail(res, 400, 'ID pesanan tidak valid.');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Mencegah pesanan ganda akibat klik/kirim berulang
      const [duplicate] = await connection.query(
        'SELECT id, order_number FROM orders WHERE idempotency_key = ?',
        [idempotencyKey]
      );

      if (duplicate.length > 0) {
        await connection.rollback();

        return ok(res, {
          id: duplicate[0].id,
          orderNumber: duplicate[0].order_number,
          message: 'Pesanan sudah pernah tercatat.',
        });
      }

      // Mengambil shift yang sedang terbuka
      const [shifts] = await connection.query(
        `SELECT id, cashier_id, business_date
         FROM shifts
         WHERE status = 'open'
         ORDER BY started_at DESC
         LIMIT 1
         FOR UPDATE`
      );

      const shift = shifts[0];

      if (!shift) {
        await connection.rollback();
        return fail(
          res,
          409,
          'Tidak ada shift aktif. Mulai shift terlebih dahulu.'
        );
      }

      // Kasir hanya boleh membuat pesanan pada shift miliknya
      if (
        req.user.role === 'cashier' &&
        Number(shift.cashier_id) !== Number(req.user.id)
      ) {
        await connection.rollback();
        return fail(res, 403, 'Shift ini bukan milikmu.');
      }

      let total = 0;
      const orderItems = [];

      // Harga diambil dari database, bukan dari frontend
      for (const item of items) {
        const menuId = Number(item.menu_id);
        const quantity = Number(item.quantity);

        if (
          !Number.isInteger(menuId) ||
          menuId <= 0 ||
          !Number.isInteger(quantity) ||
          quantity <= 0
        ) {
          await connection.rollback();
          return fail(res, 400, 'Menu atau jumlah item tidak valid.');
        }

        const [menus] = await connection.query(
          `SELECT id, price, is_active, is_available
           FROM menus
           WHERE id = ?`,
          [menuId]
        );

        const menu = menus[0];

        if (!menu) {
          await connection.rollback();
          return fail(res, 404, 'Menu tidak ditemukan.');
        }

        if (!menu.is_active || !menu.is_available) {
          await connection.rollback();
          return fail(res, 400, 'Menu sedang habis atau nonaktif.');
        }

        const unitPrice = Number(menu.price);
        const subtotal = unitPrice * quantity;

        total += subtotal;

        orderItems.push({
          menuId,
          quantity,
          unitPrice,
          subtotal,
        });
      }

      // Membuat nomor pesanan
      const datePart = String(shift.business_date).replaceAll('-', '');
      const orderNumber = `TH-${datePart}-${Date.now()}`;

      // Menyimpan data pesanan
      const [orderResult] = await connection.query(
        `INSERT INTO orders
          (
            order_number,
            idempotency_key,
            shift_id,
            business_date,
            cashier_id,
            customer_name,
            note,
            total,
            status
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
        [
          orderNumber,
          idempotencyKey,
          shift.id,
          shift.business_date,
          req.user.id,
          customerName.trim(),
          note.trim(),
          total,
        ]
      );

      // Menyimpan detail item pesanan
      for (const item of orderItems) {
        await connection.query(
          `INSERT INTO order_items
            (order_id, menu_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.menuId,
            item.quantity,
            item.unitPrice,
            item.subtotal,
          ]
        );
      }

      await connection.commit();

      return ok(
        res,
        {
          id: orderResult.insertId,
          orderNumber,
          customerName: customerName.trim(),
          note: note.trim(),
          total,
          status: 'pending_payment',
          items: orderItems,
        },
        201
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);


 // Menampilkan daftar pesanan
router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Mengambil daftar pesanan dari database
    const [orders] = await pool.query(
      `SELECT
        o.id,
        o.order_number AS orderNumber,
        o.customer_name AS customerName,
        o.note,
        o.total,
        o.status,
        o.business_date AS businessDate,
        o.created_at AS createdAt
       FROM orders o
       ORDER BY o.id DESC`
    );

    // Jika belum ada pesanan
    if (orders.length === 0) {
      return ok(res, []);
    }

    // Mengambil detail item dari seluruh pesanan
    const orderIds = orders.map((order) => order.id);
    const placeholders = orderIds.map(() => '?').join(', ');

    const [items] = await pool.query(
      `SELECT
        oi.order_id AS orderId,
        oi.menu_id AS menuId,
        m.name AS menuName,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.subtotal
       FROM order_items oi
       JOIN menus m ON m.id = oi.menu_id
       WHERE oi.order_id IN (${placeholders})`,
      orderIds
    );

    // Menggabungkan detail item ke masing-masing pesanan
    const result = orders.map((order) => ({
      ...order,
      items: items.filter(
        (item) => Number(item.orderId) === Number(order.id)
      ),
    }));

    return ok(res, result);
  })
);


 // Menampilkan detail pesanan berdasarkan ID
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);

    // Validasi ID pesanan
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail(res, 400, 'ID pesanan tidak valid.');
    }

    // Mengambil data pesanan
    const [orders] = await pool.query(
      `SELECT
        o.id,
        o.order_number AS orderNumber,
        o.customer_name AS customerName,
        o.note,
        o.total,
        o.status,
        o.business_date AS businessDate,
        o.created_at AS createdAt
       FROM orders o
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return fail(res, 404, 'Pesanan tidak ditemukan.');
    }

    // Mengambil detail item pesanan
    const [items] = await pool.query(
      `SELECT
        oi.menu_id AS menuId,
        m.name AS menuName,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.subtotal
       FROM order_items oi
       JOIN menus m ON m.id = oi.menu_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    return ok(res, {
      ...orders[0],
      items,
    });
  })
);

export default router;
