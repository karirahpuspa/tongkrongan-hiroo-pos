import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Lock,
  Printer,
  X,
} from 'lucide-react';
import { usePos } from '../store/posStore';
import { Order, Shift } from '../types/pos';
import {
  formatDateID,
  formatRupiah,
  formatTimeWIB,
  getTodayDateStr,
  getYesterdayDateStr,
} from '../utils/format';
import { ReceiptModal } from './ReceiptModal';

export const OwnerReportsView: React.FC = () => {
  const { currentUser, orders, shifts, closeShift, getShiftCashSummary } =
    usePos();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Force-close modal for open shift (FR-11)
  const [forceCloseShift, setForceCloseShift] = useState<Shift | null>(null);
  const [forceActualCash, setForceActualCash] = useState<string>('0');
  const [forceNote, setForceNote] = useState<string>('');
  const [forceError, setForceError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const today = getTodayDateStr();
  const yesterday = getYesterdayDateStr();

  const filteredPaidOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.payment?.status !== 'paid') return false;
      if (startDate && o.business_date < startDate) return false;
      if (endDate && o.business_date > endDate) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (startDate && s.business_date < startDate) return false;
      if (endDate && s.business_date > endDate) return false;
      return true;
    });
  }, [shifts, startDate, endDate]);

  const summary = useMemo(() => {
    const totalRevenue = filteredPaidOrders.reduce((s, o) => s + o.total, 0);
    const cashOrders = filteredPaidOrders.filter(
      (o) => o.payment?.method === 'cash'
    );
    const qrisOrders = filteredPaidOrders.filter(
      (o) => o.payment?.method === 'qris'
    );
    const cashRevenue = cashOrders.reduce((s, o) => s + o.total, 0);
    const qrisRevenue = qrisOrders.reduce((s, o) => s + o.total, 0);

    return {
      totalRevenue,
      totalCount: filteredPaidOrders.length,
      cashRevenue,
      cashCount: cashOrders.length,
      qrisRevenue,
      qrisCount: qrisOrders.length,
    };
  }, [filteredPaidOrders]);

  const topMenus = useMemo(() => {
    const map = new Map<
      string,
      { menu_name: string; qty: number; revenue: number }
    >();
    for (const order of filteredPaidOrders) {
      for (const item of order.items) {
        const cur = map.get(item.menu_id) ?? {
          menu_name: item.menu_name,
          qty: 0,
          revenue: 0,
        };
        cur.qty += item.quantity;
        cur.revenue += item.subtotal;
        map.set(item.menu_id, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [filteredPaidOrders]);

  const perCashierSummary = useMemo(() => {
    const map = new Map<
      string,
      { cashier_name: string; txCount: number; cashTotal: number; qrisTotal: number; total: number }
    >();
    for (const order of filteredPaidOrders) {
      const cur = map.get(order.cashier_id) ?? {
        cashier_name: order.cashier_name,
        txCount: 0,
        cashTotal: 0,
        qrisTotal: 0,
        total: 0,
      };
      cur.txCount += 1;
      cur.total += order.total;
      if (order.payment?.method === 'cash') cur.cashTotal += order.total;
      if (order.payment?.method === 'qris') cur.qrisTotal += order.total;
      map.set(order.cashier_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredPaidOrders]);

  if (currentUser?.role !== 'owner') {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="hiroo-card p-6 text-center">
          <h2 className="text-lg font-extrabold text-[#991B1B]">Akses Ditolak</h2>
          <p className="text-xs text-[#5A554E] mt-1">
            Kasir tidak memiliki akses ke Laporan Keuangan.
          </p>
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const header = [
      'Tanggal Bisnis',
      'No. Pesanan',
      'Jam',
      'Kasir',
      'Pelanggan',
      'Item',
      'Catatan',
      'Total',
      'Metode Bayar',
      'No. Rekening QRIS',
      'Nama Pemilik QRIS',
      'Status',
    ];
    const rows = filteredPaidOrders.map((o) => [
      o.business_date,
      o.order_number,
      formatTimeWIB(o.created_at),
      o.cashier_name,
      o.customer_name,
      o.items.map((i) => `${i.quantity}x ${i.menu_name}`).join('; '),
      o.note || '-',
      String(o.total),
      o.payment?.method === 'cash' ? 'Tunai' : 'QRIS',
      o.payment?.qris_account_number ?? '-',
      o.payment?.qris_account_name ?? '-',
      o.status,
    ]);

    const csvContent =
      '\uFEFF' +
      [header, ...rows]
        .map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-tongkrongan-hiroo-${startDate || 'semua'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const tableRows = filteredPaidOrders
      .map(
        (o) => `
      <tr>
        <td>${o.business_date}</td>
        <td>${o.order_number}</td>
        <td>${formatTimeWIB(o.created_at)}</td>
        <td>${o.cashier_name}</td>
        <td>${o.customer_name}</td>
        <td>${o.items.map((i) => `${i.quantity}x ${i.menu_name}`).join(', ')}</td>
        <td>${o.note || '-'}</td>
        <td>${o.total}</td>
        <td>${o.payment?.method === 'cash' ? 'Tunai' : 'QRIS'}</td>
        <td>${o.payment?.qris_account_number ?? '-'}</td>
        <td>${o.payment?.qris_account_name ?? '-'}</td>
        <td>${o.status}</td>
      </tr>`
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>
        <h3>Laporan Keuangan Tongkrongan Hiroo</h3>
        <table border="1">
          <thead>
            <tr>
              <th>Tanggal Bisnis</th><th>No. Pesanan</th><th>Jam</th><th>Kasir</th>
              <th>Pelanggan</th><th>Item</th><th>Catatan</th><th>Total</th>
              <th>Metode</th><th>No. Rek QRIS</th><th>Pemilik QRIS</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-tongkrongan-hiroo-${startDate || 'semua'}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleForceCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceCloseShift) return;
    setForceError(null);
    const res = closeShift({
      shiftId: forceCloseShift.id,
      actualCash: Number(forceActualCash),
      note: forceNote,
    });
    if (!res.success) {
      setForceError(res.message);
      return;
    }
    setForceCloseShift(null);
    setToastMsg(res.message);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-10 space-y-5 print-report-container">
      {/* Header & Actions */}
      <div className="hiroo-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
            Laporan Keuangan Owner
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">
            Rekap Penjualan & Rekonsiliasi Shift
          </h1>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Hanya menghitung transaksi lunas (paid). Pesanan belum bayar & dibatalkan tidak masuk omzet.
          </p>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="rounded-full border-[1.5px] border-[#141414] bg-white px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-zinc-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="rounded-full border-[1.5px] border-[#141414] bg-[#EEF6E4] px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#DFECCE] cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hiroo-btn-dark rounded-full px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="no-print hiroo-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block font-mono-tabular text-[10px] font-bold uppercase text-[#5A554E] mb-1">
            Dari Tanggal Bisnis
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-[#141414] bg-white px-3 py-1.5 text-xs font-mono-tabular"
          />
        </div>
        <div>
          <label className="block font-mono-tabular text-[10px] font-bold uppercase text-[#5A554E] mb-1">
            Sampai Tanggal Bisnis
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-[#141414] bg-white px-3 py-1.5 text-xs font-mono-tabular"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className={`rounded-full border border-[#141414] px-3 py-1.5 text-xs font-bold cursor-pointer ${
              !startDate && !endDate ? 'bg-[#141414] text-white' : 'bg-white'
            }`}
          >
            Semua Tanggal
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(today);
              setEndDate(today);
            }}
            className={`rounded-full border border-[#141414] px-3 py-1.5 text-xs font-bold cursor-pointer ${
              startDate === today && endDate === today
                ? 'bg-[#141414] text-white'
                : 'bg-white'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(yesterday);
              setEndDate(yesterday);
            }}
            className={`rounded-full border border-[#141414] px-3 py-1.5 text-xs font-bold cursor-pointer ${
              startDate === yesterday && endDate === yesterday
                ? 'bg-[#141414] text-white'
                : 'bg-white'
            }`}
          >
            Kemarin
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl border-[1.5px] border-[#141414] bg-[#F5E74B] px-4 py-2.5 text-xs font-bold">
          {toastMsg}
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="hiroo-card p-4 bg-[#F6F2D4]">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Total Pemasukan (Paid)
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular">
            {formatRupiah(summary.totalRevenue)}
          </p>
        </div>
        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Jumlah Transaksi
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular">
            {summary.totalCount}
          </p>
        </div>
        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Tunai ({summary.cashCount} trx)
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular">
            {formatRupiah(summary.cashRevenue)}
          </p>
        </div>
        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            QRIS ({summary.qrisCount} trx)
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular">
            {formatRupiah(summary.qrisRevenue)}
          </p>
        </div>
      </div>

      {/* Top Selling Menus & Per-Cashier Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="hiroo-card p-5">
          <h2 className="text-base font-extrabold mb-3">Menu Terlaris</h2>
          {topMenus.length === 0 ? (
            <p className="text-xs text-[#5A554E]">Belum ada penjualan pada rentang tanggal ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono-tabular">
                <thead>
                  <tr className="border-b border-[#141414]/20 text-[#5A554E]">
                    <th className="py-2 pr-3">Menu</th>
                    <th className="py-2 pr-3 text-right">Terjual</th>
                    <th className="py-2 text-right">Pendapatan</th>
                  </tr>
                </thead>
                <tbody>
                  {topMenus.map((m) => (
                    <tr key={m.menu_name} className="border-b border-[#141414]/10">
                      <td className="py-2 pr-3 font-sans font-bold">{m.menu_name}</td>
                      <td className="py-2 pr-3 text-right">{m.qty} porsi</td>
                      <td className="py-2 text-right font-bold">
                        {formatRupiah(m.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="hiroo-card p-5">
          <h2 className="text-base font-extrabold mb-3">Rekap Per Kasir</h2>
          {perCashierSummary.length === 0 ? (
            <p className="text-xs text-[#5A554E]">Belum ada transaksi per kasir.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono-tabular">
                <thead>
                  <tr className="border-b border-[#141414]/20 text-[#5A554E]">
                    <th className="py-2 pr-3">Kasir</th>
                    <th className="py-2 pr-3 text-right">Trx</th>
                    <th className="py-2 pr-3 text-right">Tunai</th>
                    <th className="py-2 pr-3 text-right">QRIS</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {perCashierSummary.map((c) => (
                    <tr key={c.cashier_name} className="border-b border-[#141414]/10">
                      <td className="py-2 pr-3 font-sans font-bold">{c.cashier_name}</td>
                      <td className="py-2 pr-3 text-right">{c.txCount}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(c.cashTotal)}</td>
                      <td className="py-2 pr-3 text-right">{formatRupiah(c.qrisTotal)}</td>
                      <td className="py-2 text-right font-bold">{formatRupiah(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Shift & Cash Variance Table */}
      <div className="hiroo-card p-5">
        <h2 className="text-base font-extrabold mb-3">Selisih Kas Per Shift</h2>
        {filteredShifts.length === 0 ? (
          <p className="text-xs text-[#5A554E]">Tidak ada data shift pada filter ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono-tabular">
              <thead>
                <tr className="border-b border-[#141414]/20 text-[#5A554E]">
                  <th className="py-2 pr-3">Shift</th>
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 pr-3">Kasir</th>
                  <th className="py-2 pr-3 text-right">Modal Awal</th>
                  <th className="py-2 pr-3 text-right">Kas Seharusnya</th>
                  <th className="py-2 pr-3 text-right">Uang Fisik</th>
                  <th className="py-2 pr-3 text-right">Selisih</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((s) => {
                  const live = getShiftCashSummary(s.id);
                  const expected = s.expected_cash ?? live.expectedCash;
                  return (
                    <tr key={s.id} className="border-b border-[#141414]/10">
                      <td className="py-2.5 pr-3 font-bold">{s.shift_code}</td>
                      <td className="py-2.5 pr-3">{formatDateID(s.business_date)}</td>
                      <td className="py-2.5 pr-3 font-sans">{s.cashier_name}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRupiah(s.opening_cash)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRupiah(expected)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {s.actual_cash !== null ? formatRupiah(s.actual_cash) : '-'}
                      </td>
                      <td
                        className={`py-2.5 pr-3 text-right font-bold ${
                          (s.difference ?? 0) < 0
                            ? 'text-[#C93B2B]'
                            : 'text-[#365911]'
                        }`}
                      >
                        {s.difference !== null ? formatRupiah(s.difference) : '-'}
                      </td>
                      <td className="py-2.5 text-right">
                        {s.status === 'closed' ? (
                          <span className="rounded-full bg-[#EEF6E4] border border-[#141414]/30 px-2.5 py-0.5 text-[10px] font-bold">
                            Ditutup
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setForceCloseShift(s);
                              setForceActualCash(String(expected));
                              setForceNote('');
                              setForceError(null);
                            }}
                            className="no-print inline-flex items-center gap-1 rounded-full bg-[#C93B2B] text-white px-2.5 py-0.5 text-[10px] font-bold cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Tutup Paksa</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Transactions List (with QRIS Account Info visible to Owner!) */}
      <div className="hiroo-card p-5">
        <h2 className="text-base font-extrabold mb-1">
          Daftar Transaksi Lunas (Termasuk Detail Rekening QRIS Owner)
        </h2>
        <p className="text-xs text-[#5A554E] mb-3">
          Kolom rekening & nama pemilik QRIS hanya tampil di tampilan Owner ini.
        </p>
        {filteredPaidOrders.length === 0 ? (
          <p className="text-xs text-[#5A554E]">Belum ada transaksi lunas pada rentang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono-tabular">
              <thead>
                <tr className="border-b border-[#141414]/20 text-[#5A554E]">
                  <th className="py-2 pr-3">No. Pesanan</th>
                  <th className="py-2 pr-3">Tanggal & Jam</th>
                  <th className="py-2 pr-3">Kasir</th>
                  <th className="py-2 pr-3">Pelanggan</th>
                  <th className="py-2 pr-3">Metode</th>
                  <th className="py-2 pr-3">Info Rekening QRIS (Owner)</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="no-print py-2 text-right">Struk</th>
                </tr>
              </thead>
              <tbody>
                {filteredPaidOrders.map((o) => (
                  <tr key={o.id} className="border-b border-[#141414]/10">
                    <td className="py-2.5 pr-3 font-bold">{o.order_number}</td>
                    <td className="py-2.5 pr-3">
                      {o.business_date} · {formatTimeWIB(o.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 font-sans">{o.cashier_name}</td>
                    <td className="py-2.5 pr-3 font-sans font-semibold">
                      {o.customer_name}
                    </td>
                    <td className="py-2.5 pr-3 uppercase font-bold">
                      {o.payment?.method === 'cash' ? 'Tunai' : 'QRIS'}
                    </td>
                    <td className="py-2.5 pr-3 font-sans">
                      {o.payment?.method === 'qris' ? (
                        <span>
                          <strong>{o.payment.qris_account_name}</strong> ·{' '}
                          <span className="font-mono-tabular">
                            {o.payment.qris_account_number}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#5A554E]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold">
                      {formatRupiah(o.total)}
                    </td>
                    <td className="no-print py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setReceiptOrder(o)}
                        className="rounded-full border border-[#141414] bg-white px-2.5 py-1 text-[10px] font-bold hover:bg-zinc-100 cursor-pointer"
                      >
                        Struk
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Owner Force-Close Shift Modal */}
      {forceCloseShift && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleForceCloseSubmit}
            className="w-full max-w-md hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#991B1B]">
                Tutup Paksa Shift {forceCloseShift.shift_code}
              </h3>
              <button
                type="button"
                onClick={() => setForceCloseShift(null)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#5A554E]">
              Kasir <strong>{forceCloseShift.cashier_name}</strong> belum menutup shift ini.
              Owner dapat menutup paksa dengan mencatat uang fisik & alasan.
            </p>
            <div>
              <label className="block text-xs font-bold mb-1">Uang Fisik (Rp)</label>
              <input
                type="number"
                min={0}
                value={forceActualCash}
                onChange={(e) => setForceActualCash(e.target.value)}
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 font-mono-tabular text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                Catatan Tutup Paksa *Wajib
              </label>
              <textarea
                rows={2}
                value={forceNote}
                onChange={(e) => setForceNote(e.target.value)}
                placeholder="Misal: Kasir lupa menutup shift malam, dicek oleh Owner."
                className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
              />
            </div>
            {forceError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{forceError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-[#C93B2B] border-[1.5px] border-[#141414] py-2.5 text-xs font-bold text-white cursor-pointer"
            >
              Konfirmasi Tutup Paksa Shift
            </button>
          </form>
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
