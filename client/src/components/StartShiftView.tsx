import React, { useState } from 'react';
import { AlertTriangle, Clock, Play, Wallet } from 'lucide-react';
import { usePos } from '../store/posStore';
import {
  formatDateID,
  formatRupiah,
  getCurrentTimeInput,
  getTodayDateStr,
} from '../utils/format';

interface StartShiftViewProps {
  onShiftStarted?: () => void;
}

export const StartShiftView: React.FC<StartShiftViewProps> = ({ onShiftStarted }) => {
  const { currentUser, activeShift, startShift, logout } = usePos();
  const [startTime, setStartTime] = useState<string>(() => getCurrentTimeInput());
  const [openingCashInput, setOpeningCashInput] = useState<string>('200000');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = getTodayDateStr();
  const parsedCash = openingCashInput.trim() === '' ? NaN : Number(openingCashInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (Number.isNaN(parsedCash) || parsedCash < 0) {
      setErrorMsg('Modal awal kas wajib diisi (minimal Rp 0).');
      return;
    }
    const res = startShift({
      startTimeHHMM: startTime,
      openingCash: parsedCash,
    });
    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }
    onShiftStarted?.();
  };

  // FR-11: Warn if another cashier has an unclosed shift
  if (activeShift && currentUser && activeShift.cashier_id !== currentUser.id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="hiroo-card p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl border border-[#C93B2B] bg-[#FDECEC] p-4 text-[#991B1B]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Shift Sebelumnya Belum Ditutup</p>
              <p className="mt-1">
                Shift <strong>{activeShift.shift_code}</strong> milik{' '}
                <strong>{activeShift.cashier_name}</strong> (Tanggal Bisnis{' '}
                {formatDateID(activeShift.business_date)}) masih berstatus terbuka.
              </p>
              <p className="mt-2 text-xs">
                Hanya satu shift aktif yang diperbolehkan dalam satu waktu. Minta{' '}
                {activeShift.cashier_name} menutup shift atau minta Owner menutup paksa di menu
                Tutup Kasir / Laporan.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={logout}
              className="hiroo-btn-dark rounded-full px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              Ganti Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <div className="hiroo-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#141414]/15">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-widest text-[#5A554E]">
              Persiapan Laci Kasir
            </p>
            <h1 className="text-2xl font-bold text-[#141414] mt-0.5">Mulai Shift Kasir</h1>
          </div>
          <div className="rounded-xl bg-[#F6F2D4] border border-[#141414] px-3.5 py-2 text-right">
            <p className="font-mono-tabular text-[10px] uppercase text-[#5A554E]">Tanggal Bisnis</p>
            <p className="text-xs font-bold text-[#141414]">{formatDateID(todayStr)}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[#5A554E] leading-relaxed">
          Halo <strong>{currentUser?.name}</strong>, isi jam mulai dan modal awal di laci kas
          sebelum mencatat pesanan. Transaksi lewat pukul 00:00 tetap masuk tanggal bisnis ini.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="shift-start-time"
              className="block text-xs font-bold uppercase tracking-wider text-[#141414] mb-1.5"
            >
              Jam Mulai Shift (Manual)
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-[#5A554E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shift-start-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white pl-10 pr-4 py-3 text-base font-mono-tabular font-semibold text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#141414]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="shift-opening-cash"
              className="block text-xs font-bold uppercase tracking-wider text-[#141414] mb-1.5"
            >
              Modal Awal Laci Kas (Wajib, boleh 0)
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 text-[#5A554E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shift-opening-cash"
                type="number"
                min={0}
                step={1000}
                required
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                placeholder="Contoh: 200000"
                className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white pl-10 pr-4 py-3 text-base font-mono-tabular font-semibold text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#141414]"
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[0, 100000, 200000, 300000, 500000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setOpeningCashInput(String(preset))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-mono-tabular font-semibold cursor-pointer transition-colors ${
                    Number(openingCashInput) === preset
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-white text-[#141414] border-[#141414]/40 hover:border-[#141414]'
                  }`}
                >
                  {formatRupiah(preset)}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#C93B2B] bg-[#FDECEC] px-4 py-3 text-xs font-medium text-[#991B1B]"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-full bg-[#5F9227] border-[1.5px] border-[#141414] py-3.5 px-6 text-sm font-bold text-white hover:bg-[#527F20] transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Buka Shift & Masuk Kasir</span>
          </button>
        </form>
      </div>
    </div>
  );
};
