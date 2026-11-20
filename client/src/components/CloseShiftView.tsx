import React, { useMemo, useState } from 'react';
import { Lock, Minus, Plus, Printer } from 'lucide-react';
import { usePos } from '../store/posStore';
import { Shift } from '../types/pos';
import { formatDateID, formatRupiah, formatTimeWIB } from '../utils/format';

const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];

interface CloseShiftViewProps {
  onBackToCashier: () => void;
}

export const CloseShiftView: React.FC<CloseShiftViewProps> = ({
  onBackToCashier,
}) => {
  const { currentUser, activeShift, shifts, getShiftCashSummary, closeShift } =
    usePos();

  const [inputMode, setInputMode] = useState<'denomination' | 'manual'>('denomination');
  const [counts, setCounts] = useState<Record<number, number>>({
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
  });
  const [manualCashInput, setManualCashInput] = useState<string>('');
  const [shiftNote, setShiftNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedRecap, setClosedRecap] = useState<Shift | null>(null);

  const denominationTotal = useMemo(
    () => DENOMINATIONS.reduce((acc, d) => acc + d * (counts[d] ?? 0), 0),
    [counts]
  );

  const actualCash =
    inputMode === 'denomination'
      ? denominationTotal
      : manualCashInput.trim() === ''
      ? 0
      : Number(manualCashInput);

  const isOwner = currentUser?.role === 'owner';
  const myClosedShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.status === 'closed')
        .filter((s) => isOwner || s.cashier_id === currentUser?.id),
    [shifts, isOwner, currentUser]
  );

  if (closedRecap) {
    const recapSummary = getShiftCashSummary(closedRecap.id);
    const diff = closedRecap.difference ?? 0;

    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="hiroo-card p-6 sm:p-8 print-report-container space-y-5">
          <div className="flex items-start justify-between border-b border-[#141414]/15 pb-4">
            <div>
              <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
                Rekap Tutup Shift
              </p>
              <h1 className="text-2xl font-extrabold text-[#141414]">
                {closedRecap.shift_code} · {closedRecap.cashier_name}
              </h1>
              <p className="text-xs text-[#5A554E] mt-0.5">
                {formatDateID(closedRecap.business_date)} ·{' '}
                {formatTimeWIB(closedRecap.started_at)} –{' '}
                {closedRecap.ended_at ? formatTimeWIB(closedRecap.ended_at) : '-'}{' '}
                WIB
              </p>
            </div>
            <span className="rounded-full bg-[#5F9227] border border-[#141414] px-3 py-1 font-mono-tabular text-xs font-bold text-white">
              Selesai Ditutup
            </span>
          </div>

          <div className="space-y-2 text-sm font-mono-tabular">
            <div className="flex justify-between">
              <span className="text-[#5A554E]">Modal Awal Kas</span>
              <strong>{formatRupiah(closedRecap.opening_cash)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A554E]">+ Penjualan Tunai (Lunas)</span>
              <strong>{formatRupiah(recapSummary.cashSales)}</strong>
            </div>
            <div className="flex justify-between border-t border-[#141414]/15 pt-2">
              <span className="font-bold">Kas Seharusnya</span>
              <strong className="text-base">
                {formatRupiah(closedRecap.expected_cash ?? 0)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Uang Fisik Dihitung</span>
              <strong className="text-base">
                {formatRupiah(closedRecap.actual_cash ?? 0)}
              </strong>
            </div>
            <div
              className={`rounded-xl border-[1.5px] p-3 flex justify-between items-center ${
                diff === 0
                  ? 'border-[#5F9227] bg-[#EEF6E4] text-[#365911]'
                  : 'border-[#C93B2B] bg-[#FDECEC] text-[#991B1B]'
              }`}
            >
              <span className="font-bold">Selisih Kas</span>
              <strong className="text-base">
                {diff === 0
                  ? 'Rp 0 (PAS)'
                  : diff > 0
                  ? `+${formatRupiah(diff)} (LEBIH)`
                  : `${formatRupiah(diff)} (KURANG)`}
              </strong>
            </div>
            <div className="flex justify-between text-xs text-[#5A554E] pt-1">
              <span>Penjualan QRIS (Tidak masuk kas laci)</span>
              <span>{formatRupiah(recapSummary.qrisSales)}</span>
            </div>
          </div>

          {closedRecap.note && (
            <div className="rounded-xl border border-[#141414]/20 bg-white p-3 text-xs">
              <strong>Catatan: </strong>
              {closedRecap.note}
            </div>
          )}

          <div className="no-print flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 hiroo-btn-dark rounded-full py-3 px-4 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rekap Shift</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setClosedRecap(null);
                onBackToCashier();
              }}
              className="rounded-full border-[1.5px] border-[#141414] bg-white py-3 px-5 text-xs font-bold cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div className="hiroo-card p-6 text-center">
          <h2 className="text-lg font-extrabold">Belum Ada Shift Aktif</h2>
          <p className="text-xs text-[#5A554E] mt-1">
            Buka shift terlebih dahulu di halaman Kasir untuk mencatat transaksi.
          </p>
        </div>

        <div className="hiroo-card p-5">
          <h3 className="text-sm font-extrabold mb-3">Riwayat Shift Ditutup</h3>
          {myClosedShifts.length === 0 ? (
            <p className="text-xs text-[#5A554E]">Belum ada riwayat shift.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono-tabular">
                <thead>
                  <tr className="border-b border-[#141414]/20 text-[#5A554E]">
                    <th className="py-2 pr-3">Shift</th>
                    <th className="py-2 pr-3">Kasir</th>
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3 text-right">Kas Seharusnya</th>
                    <th className="py-2 pr-3 text-right">Uang Fisik</th>
                    <th className="py-2 text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {myClosedShifts.map((s) => (
                    <tr key={s.id} className="border-b border-[#141414]/10">
                      <td className="py-2.5 pr-3 font-bold">{s.shift_code}</td>
                      <td className="py-2.5 pr-3 font-sans">{s.cashier_name}</td>
                      <td className="py-2.5 pr-3">{formatDateID(s.business_date)}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRupiah(s.expected_cash ?? 0)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRupiah(s.actual_cash ?? 0)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold ${
                          (s.difference ?? 0) < 0
                            ? 'text-[#C93B2B]'
                            : 'text-[#365911]'
                        }`}
                      >
                        {formatRupiah(s.difference ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const summary = getShiftCashSummary(activeShift.id);
  const diffPreview = actualCash - summary.expectedCash;
  const isClosingOtherCashier =
    currentUser && activeShift.cashier_id !== currentUser.id;

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (Number.isNaN(actualCash) || actualCash < 0) {
      setErrorMsg('Nominal uang fisik tidak valid.');
      return;
    }
    const res = closeShift({
      shiftId: activeShift.id,
      actualCash,
      note: shiftNote,
    });
    if (!res.success || !res.data) {
      setErrorMsg(res.message);
      return;
    }
    setClosedRecap(res.data);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-10">
      <form
        onSubmit={handleCloseShift}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        {/* Left: Shift Summary & Physical Cash Counter (Figma Tutup Kasir layout) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="hiroo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
                  Shift Aktif
                </p>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">
                  {activeShift.shift_code} · {formatDateID(activeShift.business_date)}
                </h1>
              </div>
              <span className="rounded-full bg-[#5F9227] border border-[#141414] px-3 py-1 font-mono-tabular text-[11px] font-bold text-white">
                Berjalan
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 font-mono-tabular text-xs">
              <span className="rounded-full border border-[#141414] bg-white px-3 py-1">
                Kasir: <strong>{activeShift.cashier_name}</strong>
              </span>
              <span className="rounded-full border border-[#141414] bg-white px-3 py-1">
                Buka: <strong>{formatTimeWIB(activeShift.started_at)} WIB</strong>
              </span>
              <span className="rounded-full border border-[#141414] bg-white px-3 py-1">
                Modal Awal: <strong>{formatRupiah(activeShift.opening_cash)}</strong>
              </span>
            </div>
          </div>

          {/* 4 Metric Boxes matching Figma */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="hiroo-card p-3.5">
              <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                Transaksi Lunas
              </p>
              <p className="mt-1 text-xl font-extrabold font-mono-tabular">
                {summary.paidOrdersCount}
              </p>
            </div>
            <div className="hiroo-card p-3.5">
              <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                Total Penjualan
              </p>
              <p className="mt-1 text-base sm:text-lg font-extrabold font-mono-tabular">
                {formatRupiah(summary.cashSales + summary.qrisSales)}
              </p>
            </div>
            <div className="hiroo-card p-3.5">
              <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                Tunai
              </p>
              <p className="mt-1 text-base sm:text-lg font-extrabold font-mono-tabular">
                {formatRupiah(summary.cashSales)}
              </p>
            </div>
            <div className="hiroo-card p-3.5">
              <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                QRIS
              </p>
              <p className="mt-1 text-base sm:text-lg font-extrabold font-mono-tabular">
                {formatRupiah(summary.qrisSales)}
              </p>
            </div>
          </div>

          {/* Physical Cash Verification (Figma Denomination Counter + Manual Toggle) */}
          <div className="hiroo-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                  Verifikasi Fisik
                </p>
                <h2 className="text-lg font-extrabold text-[#141414]">
                  Hitung Uang di Laci
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setInputMode((m) =>
                    m === 'denomination' ? 'manual' : 'denomination'
                  )
                }
                className="rounded-full border border-[#141414] bg-[#F5E74B] px-3.5 py-1.5 font-mono-tabular text-[11px] font-bold text-[#141414] cursor-pointer"
              >
                {inputMode === 'denomination'
                  ? 'Ganti ke Input Total Langsung'
                  : 'Ganti ke Hitung Pecahan'}
              </button>
            </div>

            {inputMode === 'denomination' ? (
              <div className="space-y-2.5">
                {DENOMINATIONS.map((denom) => {
                  const qty = counts[denom] ?? 0;
                  return (
                    <div
                      key={denom}
                      className="flex items-center justify-between gap-3 py-1.5 border-b border-[#141414]/10 font-mono-tabular text-xs sm:text-sm"
                    >
                      <span className="font-bold w-28">{formatRupiah(denom)}</span>
                      <div className="inline-flex items-center rounded-full border border-[#141414] bg-white px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCounts((p) => ({
                              ...p,
                              [denom]: Math.max(0, (p[denom] ?? 0) - 1),
                            }))
                          }
                          aria-label={`Kurangi pecahan ${denom}`}
                          className="w-7 h-7 flex items-center justify-center hover:bg-zinc-100 rounded-full cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) =>
                            setCounts((p) => ({
                              ...p,
                              [denom]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-12 text-center font-bold bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCounts((p) => ({
                              ...p,
                              [denom]: (p[denom] ?? 0) + 1,
                            }))
                          }
                          aria-label={`Tambah pecahan ${denom}`}
                          className="w-7 h-7 flex items-center justify-center hover:bg-zinc-100 rounded-full cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-bold text-right w-28">
                        {formatRupiah(denom * qty)}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-2 flex items-center justify-between font-mono-tabular text-base font-extrabold">
                  <span>TOTAL UANG DIHITUNG</span>
                  <span>{formatRupiah(denominationTotal)}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Total Uang Fisik di Laci (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={manualCashInput}
                  onChange={(e) => setManualCashInput(e.target.value)}
                  placeholder="Masukkan total uang fisik tunai..."
                  className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white px-4 py-3 font-mono-tabular text-base font-bold"
                />
              </div>
            )}
          </div>

          <div className="hiroo-card p-5">
            <label
              htmlFor="shift-close-note"
              className="block font-mono-tabular text-[11px] font-bold uppercase text-[#5A554E] mb-2"
            >
              Catatan Shift {isClosingOtherCashier ? '(Wajib untuk Tutup Paksa Owner)' : '(Opsional)'}
            </label>
            <textarea
              id="shift-close-note"
              rows={2}
              value={shiftNote}
              onChange={(e) => setShiftNote(e.target.value)}
              placeholder="Tulis catatan selisih kas atau keterangan serah terima untuk Owner..."
              className="w-full rounded-xl border border-[#141414]/40 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#141414]"
            />
          </div>
        </section>

        {/* Right: Cash Reconciliation Box */}
        <aside className="lg:col-span-5 hiroo-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#141414]/15 pb-3">
            <div>
              <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">
                Rekonsiliasi Kas
              </p>
              <h2 className="text-lg font-extrabold font-mono-tabular">
                TUTUP SHIFT #{activeShift.shift_code}
              </h2>
            </div>
            <span className="rounded-full bg-[#CBBCE6] border border-[#141414] px-3 py-1 font-mono-tabular text-[10px] font-bold uppercase">
              Menunggu Konfirmasi
            </span>
          </div>

          <div className="space-y-2 text-xs sm:text-sm font-mono-tabular">
            <div className="flex justify-between">
              <span className="text-[#5A554E]">MODAL AWAL</span>
              <span>{formatRupiah(summary.openingCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A554E]">+ PENJUALAN TUNAI</span>
              <span>{formatRupiah(summary.cashSales)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#141414]/15 font-bold">
              <span>UANG SEHARUSNYA</span>
              <span>{formatRupiah(summary.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>UANG DIHITUNG</span>
              <span>{formatRupiah(actualCash)}</span>
            </div>
          </div>

          <div
            className={`rounded-2xl border-[1.5px] p-4 ${
              diffPreview === 0
                ? 'border-[#5F9227] bg-[#EEF6E4] text-[#365911]'
                : 'border-[#C93B2B] bg-[#FDECEC] text-[#991B1B]'
            }`}
          >
            <div className="flex items-center justify-between font-mono-tabular text-xs font-bold mb-1">
              <span>SELISIH</span>
              <span className="rounded-full border border-current px-2.5 py-0.5 text-[10px] uppercase">
                {diffPreview === 0
                  ? 'Pas'
                  : diffPreview < 0
                  ? 'Kurang'
                  : 'Lebih'}
              </span>
            </div>
            <p className="font-mono-tabular text-2xl font-extrabold">
              {diffPreview > 0 ? '+' : ''}
              {formatRupiah(diffPreview)}
            </p>
          </div>

          <div className="rounded-xl border border-[#141414]/20 bg-white px-3.5 py-2.5 font-mono-tabular text-xs">
            <div className="flex justify-between">
              <span className="text-[#5A554E]">PENJUALAN NON-TUNAI (QRIS)</span>
              <strong>{formatRupiah(summary.qrisSales)}</strong>
            </div>
            <p className="text-[10px] text-[#5A554E] mt-1">
              * Tidak masuk hitungan uang tunai di laci kasir.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#C93B2B] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#991B1B]"
            >
              {errorMsg}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              className="w-full hiroo-btn-dark rounded-full py-3.5 px-4 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Tutup Kasir & Simpan Rekap</span>
            </button>
            <button
              type="button"
              onClick={onBackToCashier}
              className="w-full rounded-full border-[1.5px] border-[#141414] bg-white py-2.5 px-4 text-xs font-bold cursor-pointer hover:bg-zinc-100"
            >
              Kembali ke Kasir
            </button>
          </div>

          <p className="text-center font-mono-tabular text-[10px] text-[#5A554E]">
            * Setelah ditutup, data shift tersimpan otomatis untuk laporan Owner.
          </p>
        </aside>
      </form>
    </div>
  );
};
