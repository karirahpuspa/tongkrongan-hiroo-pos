import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, fail, ok } from '../utils/response.js';

const router = Router();

// Helper untuk format objek Order dari baris database
const formatOrder = (orderRow, items = [], isOwner = false) => {
  const payment = orderRow.payment_id
    ? {
        id: String(orderRow.payment_id),
        method: orderRow.payment_method,
        status: orderRow.payment_status,
        amount_paid: Number(orderRow.payment_amount_paid),
        change_amount: Number(orderRow.payment_change_amount || 0),
        // FR-34: Hanya Owner yang melihat nomor rekening dan nama pemilik QRIS asli
        qris_account_number: isOwner ? orderRow.payment_qris_account_number || null : null,
        qris_account_name: isOwner ? orderRow.payment_qris_account_name || null : null,
        paid_at: orderRow.payment_paid_at,
        sheet_synced_at: orderRow.payment_sheet_synced_at || null,
      }
    : null;

  return {
    id: String(orderRow.id),
    order_number: orderRow.order_number,
    idempotency_key: orderRow.idempotency_key,
    shift_id: String(orderRow.shift_id),
    business_date: orderRow.business_date,
    cashier_id: String(orderRow.cashier_id),
    cashier_name: orderRow.cashier_name,
    customer_name: orderRow.customer_name,
    note: orderRow.note || '',
    total: Number(orderRow.total),
    status: orderRow.status,
    cancel_reason: orderRow.cancel_reason || null,
    cancelled_by: orderRow.cancelled_by_name || null,
    cancelled_at: orderRow.cancelled_at || null,
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
    items: items.map((it) => ({
      id: String(it.id),
      menu_id: String(it.menu_id),
      menu_code: it.menu_code,
      menu_name: it.menu_name,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      subtotal: Number(it.subtotal),
    })),
    payment,
  };
};

// GET /api/reports/history — Mengambil daftar riwayat transaksi dari tabel orders & order_items
router.get(
  '/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isOwner = req.user?.role === 'owner';
    const conditions = ['1=1'];
    const params = [];

    // Jika Kasir: batasi hanya transaksi milik kasir atau shift yang bersangkutan
    if (!isOwner) {
      if (req.query.shiftId) {
        conditions.push('(o.cashier_id = ? OR o.shift_id = ?)');
        params.push(req.user.id, req.query.shiftId);
      } else {
        conditions.push('o.cashier_id = ?');
        params.push(req.user.id);
      }
    } else if (req.query.shiftId) {
      conditions.push('o.shift_id = ?');
      params.push(req.query.shiftId);
    }

    if (req.query.startDate) {
      conditions.push('o.business_date >= ?');
      params.push(req.query.startDate);
    }
    if (req.query.endDate) {
      conditions.push('o.business_date <= ?');
      params.push(req.query.endDate);
    }
    if (req.query.status && req.query.status !== 'all') {
      conditions.push('o.status = ?');
      params.push(req.query.status);
    }
    if (req.query.method && req.query.method !== 'all') {
      conditions.push('p.method = ?');
      params.push(req.query.method);
    }
    if (req.query.search) {
      const q = `%${String(req.query.search).trim().toLowerCase()}%`;
      conditions.push('(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ?)');
      params.push(q, q);
    }

    const [orderRows] = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.idempotency_key,
         o.shift_id,
         o.business_date,
         o.cashier_id,
         u.name AS cashier_name,
         o.customer_name,
         o.note,
         o.total,
         o.status,
         o.cancel_reason,
         cb.name AS cancelled_by_name,
         o.cancelled_at,
         o.created_at,
         o.updated_at,
         p.id AS payment_id,
         p.method AS payment_method,
         p.status AS payment_status,
         p.amount_paid AS payment_amount_paid,
         p.change_amount AS payment_change_amount,
         p.qris_account_number AS payment_qris_account_number,
         p.qris_account_name AS payment_qris_account_name,
         p.paid_at AS payment_paid_at,
         p.sheet_synced_at AS payment_sheet_synced_at
       FROM orders o
       JOIN users u ON u.id = o.cashier_id
       LEFT JOIN users cb ON cb.id = o.cancelled_by
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC`,
      params
    );

    if (orderRows.length === 0) {
      return ok(res, []);
    }

    const orderIds = orderRows.map((r) => r.id);
    const [itemRows] = await pool.query(
      `SELECT oi.id, oi.order_id, oi.menu_id, m.code AS menu_code, m.name AS menu_name,
              oi.quantity, oi.unit_price, oi.subtotal
       FROM order_items oi
       JOIN menus m ON m.id = oi.menu_id
       WHERE oi.order_id IN (?)
       ORDER BY oi.id ASC`,
      [orderIds]
    );

    const itemsByOrder = new Map();
    for (const it of itemRows) {
      if (!itemsByOrder.has(it.order_id)) {
        itemsByOrder.set(it.order_id, []);
      }
      itemsByOrder.get(it.order_id).push(it);
    }

    const result = orderRows.map((row) =>
      formatOrder(row, itemsByOrder.get(row.id) || [], isOwner)
    );

    return ok(res, result);
  })
);

// GET /api/reports/sales — Ringkasan laporan omzet & penjualan Owner
router.get(
  '/sales',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const dateConditions = [];
    const dateParams = [];

    if (req.query.startDate) {
      dateConditions.push('o.business_date >= ?');
      dateParams.push(req.query.startDate);
    }
    if (req.query.endDate) {
      dateConditions.push('o.business_date <= ?');
      dateParams.push(req.query.endDate);
    }
    const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';

    // 1. Agregasi total omzet dari pesanan berstatus paid
    const [summaryRows] = await pool.query(
      `SELECT
         COALESCE(SUM(o.total), 0) AS totalRevenue,
         COUNT(o.id) AS totalCount,
         COALESCE(SUM(CASE WHEN p.method = 'cash' THEN o.total ELSE 0 END), 0) AS cashRevenue,
         COUNT(CASE WHEN p.method = 'cash' THEN 1 END) AS cashCount,
         COALESCE(SUM(CASE WHEN p.method = 'qris' THEN o.total ELSE 0 END), 0) AS qrisRevenue,
         COUNT(CASE WHEN p.method = 'qris' THEN 1 END) AS qrisCount,
         COALESCE(AVG(o.total), 0) AS avgTransaction
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE p.status = 'paid' ${dateWhere}`,
      dateParams
    );
    const summaryRow = summaryRows[0] || {};

    // 2. Daftar Menu Terlaris
    const [topMenuRows] = await pool.query(
      `SELECT
         m.id AS menu_id,
         m.name AS menu_name,
         m.category,
         COALESCE(SUM(oi.quantity), 0) AS qty,
         COALESCE(SUM(oi.subtotal), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       JOIN menus m ON m.id = oi.menu_id
       WHERE p.status = 'paid' ${dateWhere}
       GROUP BY m.id, m.name, m.category
       ORDER BY qty DESC, revenue DESC`,
      dateParams
    );

    // 3. Rekap Transaksi per Kasir
    const [cashierRows] = await pool.query(
      `SELECT
         u.id AS cashier_id,
         u.name AS cashier_name,
         COUNT(o.id) AS txCount,
         COALESCE(SUM(CASE WHEN p.method = 'cash' THEN o.total ELSE 0 END), 0) AS cashTotal,
         COALESCE(SUM(CASE WHEN p.method = 'qris' THEN o.total ELSE 0 END), 0) AS qrisTotal,
         COALESCE(SUM(o.total), 0) AS total
       FROM orders o
       JOIN users u ON u.id = o.cashier_id
       JOIN payments p ON p.order_id = o.id
       WHERE p.status = 'paid' ${dateWhere}
       GROUP BY u.id, u.name
       ORDER BY total DESC`,
      dateParams
    );

    // 4. Rekap Omzet per Kategori Menu
    const [categoryRows] = await pool.query(
      `SELECT
         m.category,
         COALESCE(SUM(oi.quantity), 0) AS qty,
         COALESCE(SUM(oi.subtotal), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN payments p ON p.order_id = o.id
       JOIN menus m ON m.id = oi.menu_id
       WHERE p.status = 'paid' ${dateWhere}
       GROUP BY m.category
       ORDER BY revenue DESC`,
      dateParams
    );

    // 5. Rekonsiliasi Kas per Shift
    const shiftParams = [];
    const shiftConditions = [];
    if (req.query.startDate) {
      shiftConditions.push('s.business_date >= ?');
      shiftParams.push(req.query.startDate);
    }
    if (req.query.endDate) {
      shiftConditions.push('s.business_date <= ?');
      shiftParams.push(req.query.endDate);
    }
    const shiftWhere = shiftConditions.length > 0 ? `WHERE ${shiftConditions.join(' AND ')}` : '';

    const [shiftRows] = await pool.query(
      `SELECT
         s.id,
         s.shift_code,
         s.cashier_id,
         u.name AS cashier_name,
         s.business_date,
         s.started_at,
         s.ended_at,
         s.opening_cash,
         s.expected_cash,
         s.actual_cash,
         s.difference,
         s.status,
         s.closed_by,
         cb.name AS closed_by_name,
         s.note
       FROM shifts s
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN users cb ON cb.id = s.closed_by
       ${shiftWhere}
       ORDER BY s.started_at DESC`,
      shiftParams
    );

    // 6. Transaksi lunas terperinci (untuk tabel lengkap & ekspor CSV / Excel)
    const [paidOrderRows] = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.idempotency_key,
         o.shift_id,
         o.business_date,
         o.cashier_id,
         u.name AS cashier_name,
         o.customer_name,
         o.note,
         o.total,
         o.status,
         o.created_at,
         o.updated_at,
         p.id AS payment_id,
         p.method AS payment_method,
         p.status AS payment_status,
         p.amount_paid AS payment_amount_paid,
         p.change_amount AS payment_change_amount,
         p.qris_account_number AS payment_qris_account_number,
         p.qris_account_name AS payment_qris_account_name,
         p.paid_at AS payment_paid_at
       FROM orders o
       JOIN users u ON u.id = o.cashier_id
       JOIN payments p ON p.order_id = o.id
       WHERE p.status = 'paid' ${dateWhere}
       ORDER BY o.created_at DESC`,
      dateParams
    );

    let paidOrdersFormatted = [];
    if (paidOrderRows.length > 0) {
      const paidOrderIds = paidOrderRows.map((r) => r.id);
      const [paidItemRows] = await pool.query(
        `SELECT oi.id, oi.order_id, oi.menu_id, m.code AS menu_code, m.name AS menu_name,
                oi.quantity, oi.unit_price, oi.subtotal
         FROM order_items oi
         JOIN menus m ON m.id = oi.menu_id
         WHERE oi.order_id IN (?)
         ORDER BY oi.id ASC`,
        [paidOrderIds]
      );
      const itemsMap = new Map();
      for (const it of paidItemRows) {
        if (!itemsMap.has(it.order_id)) {
          itemsMap.set(it.order_id, []);
        }
        itemsMap.get(it.order_id).push(it);
      }
      paidOrdersFormatted = paidOrderRows.map((r) => formatOrder(r, itemsMap.get(r.id) || [], true));
    }

    return ok(res, {
      summary: {
        totalRevenue: Number(summaryRow.totalRevenue || 0),
        totalCount: Number(summaryRow.totalCount || 0),
        cashRevenue: Number(summaryRow.cashRevenue || 0),
        cashCount: Number(summaryRow.cashCount || 0),
        qrisRevenue: Number(summaryRow.qrisRevenue || 0),
        qrisCount: Number(summaryRow.qrisCount || 0),
        avgTransaction: Number(summaryRow.avgTransaction || 0),
      },
      topMenus: topMenuRows.map((r) => ({
        menu_id: String(r.menu_id),
        menu_name: r.menu_name,
        category: r.category,
        qty: Number(r.qty),
        revenue: Number(r.revenue),
      })),
      perCashierSummary: cashierRows.map((r) => ({
        cashier_id: String(r.cashier_id),
        cashier_name: r.cashier_name,
        txCount: Number(r.txCount),
        cashTotal: Number(r.cashTotal),
        qrisTotal: Number(r.qrisTotal),
        total: Number(r.total),
      })),
      perCategory: categoryRows.map((r) => ({
        category: r.category,
        qty: Number(r.qty),
        revenue: Number(r.revenue),
      })),
      shifts: shiftRows.map((s) => ({
        id: String(s.id),
        shift_code: s.shift_code,
        cashier_id: String(s.cashier_id),
        cashier_name: s.cashier_name,
        business_date: s.business_date,
        started_at: s.started_at,
        ended_at: s.ended_at,
        opening_cash: Number(s.opening_cash),
        expected_cash: s.expected_cash !== null ? Number(s.expected_cash) : null,
        actual_cash: s.actual_cash !== null ? Number(s.actual_cash) : null,
        difference: s.difference !== null ? Number(s.difference) : null,
        status: s.status,
        closed_by: s.closed_by ? String(s.closed_by) : null,
        closed_by_name: s.closed_by_name || null,
        note: s.note || '',
      })),
      paidOrders: paidOrdersFormatted,
    });
  })
);

export default router;
