/**
 * Google Sheets Sync Service (PRD v2.3 FR-50 s/d FR-56)
 * - 1 tab bernama "Transaksi" (1 baris per pesanan)
 * - Cek nomor pesanan unik agar tidak terjadi baris duplikat
 * - Non-blocking: kegagalan sync tidak membatalkan transaksi MySQL
 * - Tab "Rekap Bulanan" di Google Sheet memakai rumus SUMIFS/QUERY langsung dari "Transaksi"
 */
import { google } from 'googleapis';

const SHEET_TAB_NAME = process.env.GOOGLE_SHEET_TAB_NAME || 'Transaksi';

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey || !process.env.GOOGLE_SHEETS_ID) {
    throw new Error('Konfigurasi Google Sheets belum lengkap di .env');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function appendTransactionToSheet(pool, orderId) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return;

  const [orders] = await pool.query(
    `SELECT o.order_number, o.business_date, o.created_at, o.customer_name, o.note, o.total, o.status,
            u.name AS cashier_name, p.method, p.sheet_synced_at
     FROM orders o
     JOIN users u ON u.id = o.cashier_id
     JOIN payments p ON p.order_id = o.id
     WHERE o.id = ? AND p.status = 'paid' LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order || order.sheet_synced_at) return;

  const [items] = await pool.query(
    `SELECT oi.quantity, m.name FROM order_items oi JOIN menus m ON m.id = oi.menu_id WHERE oi.order_id = ?`,
    [orderId]
  );
  const itemSummary = items.map((i) => `${i.quantity}x ${i.name}`).join(', ');

  const sheets = getSheetsClient();

  // Cek nomor pesanan di kolom B agar tidak duplikat (FR-54)
  const existingCol = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB_NAME}!B:B`,
  });
  const existingOrderNumbers = (existingCol.data.values || []).flat();
  if (existingOrderNumbers.includes(order.order_number)) {
    await pool.query(`UPDATE payments SET sheet_synced_at = NOW() WHERE order_id = ?`, [orderId]);
    return;
  }

  const timeFormatted = new Date(order.created_at).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Kolom tab "Transaksi":
  // Tanggal Bisnis | No. Pesanan | Jam | Kasir | Pelanggan | Item | Catatan | Total | Metode Bayar | Status
  const rowValues = [
    order.business_date,
    order.order_number,
    timeFormatted,
    order.cashier_name,
    order.customer_name,
    itemSummary,
    order.note || '-',
    Number(order.total),
    order.method === 'cash' ? 'Tunai' : 'QRIS',
    order.status,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB_NAME}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });

  await pool.query(`UPDATE payments SET sheet_synced_at = NOW() WHERE order_id = ?`, [orderId]);
}
