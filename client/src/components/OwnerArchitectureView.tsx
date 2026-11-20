import React from 'react';
import { Database, FileCode2, Sheet } from 'lucide-react';
import { usePos } from '../store/posStore';

export const ArchitectureGuideView: React.FC = () => {
  const { currentUser } = usePos();

  if (currentUser?.role !== 'owner') {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="hiroo-card p-6 text-center">
          <h2 className="text-lg font-extrabold text-[#991B1B]">Akses Ditolak</h2>
          <p className="text-xs text-[#5A554E] mt-1">
            Hanya Owner yang dapat mengakses dokumentasi kode & skema database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-6 pb-10 space-y-5">
      <div className="hiroo-card p-6">
        <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
          Lampiran Teknis & Dokumentasi HKI (PRD v2.3)
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414] mt-0.5">
          Arsitektur React + Node.js/Express + MySQL + Google Sheets
        </h1>
        <p className="text-xs sm:text-sm text-[#5A554E] mt-1 leading-relaxed">
          Seluruh skrip SQL (<code className="font-mono-tabular">database/schema.sql</code>,{' '}
          <code className="font-mono-tabular">database/seed.sql</code>), backend Express (
          <code className="font-mono-tabular">server/</code>), dan layanan Google Sheets (
          <code className="font-mono-tabular">server/services/googleSheetsService.js</code>)
          sudah tersedia di repositori ini tanpa kredensial rahasia.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="hiroo-card p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Database className="w-4 h-4 text-[#A3431B]" />
            <h2>7 Tabel MVP MySQL</h2>
          </div>
          <ul className="font-mono-tabular text-xs space-y-1 text-[#141414]">
            <li>1. roles (owner, cashier)</li>
            <li>2. users (bcrypt password_hash)</li>
            <li>3. menus (harga, image_url, status)</li>
            <li>4. shifts (business_date, selisih kas)</li>
            <li>5. orders (HRO-YYMMDD-001, note)</li>
            <li>6. order_items (unit_price snapshot)</li>
            <li>7. payments (cash/qris, sheet_synced_at)</li>
          </ul>
          <p className="text-[11px] text-[#5A554E] pt-1">
            Lihat berkas <code className="font-mono-tabular">database/schema.sql</code> dan{' '}
            <code className="font-mono-tabular">database/seed.sql</code>.
          </p>
        </div>

        <div className="hiroo-card p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <FileCode2 className="w-4 h-4 text-[#A3431B]" />
            <h2>Express REST API & Keamanan</h2>
          </div>
          <ul className="font-mono-tabular text-xs space-y-1 text-[#141414]">
            <li>· JWT httpOnly cookie (12 jam)</li>
            <li>· Role check di middleware backend</li>
            <li>· Perhitungan total di server (authoritative)</li>
            <li>· Transaksi DB pada order + payment</li>
            <li>· Multer upload JPG/PNG/WEBP maks 2 MB</li>
            <li>· Field QRIS difilter untuk role cashier</li>
          </ul>
          <p className="text-[11px] text-[#5A554E] pt-1">
            Lihat berkas <code className="font-mono-tabular">server/app.js</code> &{' '}
            <code className="font-mono-tabular">server/routes/</code>.
          </p>
        </div>

        <div className="hiroo-card p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Sheet className="w-4 h-4 text-[#5F9227]" />
            <h2>Google Sheets Sync (Non-Blocking)</h2>
          </div>
          <ul className="text-xs space-y-1 text-[#141414]">
            <li>· Dipicu async setelah commit MySQL sukses.</li>
            <li>· Kegagalan Sheets tidak membatalkan pembayaran.</li>
            <li>· Satu tab <strong>&quot;Transaksi&quot;</strong> (1 baris per pesanan).</li>
            <li>· Cek nomor pesanan unik sebelum append agar bebas duplikat.</li>
            <li>· Tab <strong>&quot;Rekap Bulanan&quot;</strong> memakai rumus SUMIFS/QUERY di Sheet.</li>
          </ul>
          <p className="text-[11px] text-[#5A554E] pt-1">
            Lihat <code className="font-mono-tabular">server/services/googleSheetsService.js</code>{' '}
            dan <code className="font-mono-tabular">.env.example</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
