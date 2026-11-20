import React, { useState } from 'react';
import { Eye, EyeOff, Lock, RotateCcw, User as UserIcon } from 'lucide-react';
import { usePos } from '../store/posStore';

export const LoginScreen: React.FC = () => {
  const { login, resetDemoData } = usePos();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    const res = await login(username, password);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleQuickLogin = async (u: string, p: string) => {
    setErrorMsg(null);
    const res = await login(u, p);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleReset = () => {
    resetDemoData();
    setUsername('');
    setPassword('');
    setErrorMsg(null);
    setInfoMsg('Data simulasi berhasil dikembalikan ke kondisi awal.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#A3431B]">
      {/* Terracotta Hero Header matching Figma Login */}
      <header className="px-4 pt-8 pb-7 text-center text-[#141414]">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-[#8B3614]/80 px-4 py-1.5 text-xs font-medium text-[#FAF8F4] mb-5">
          <span>Portal Kasir & Operasional Toko</span>
        </div>
        <h1 className="font-brand text-5xl sm:text-6xl md:text-7xl leading-none tracking-tight text-[#141414]">
          tongkrongan Hiroo
        </h1>
        <p className="mt-3 font-mono-tabular text-[11px] sm:text-xs uppercase tracking-[0.22em] text-[#141414]/85 font-semibold">
          Masuk untuk mengelola toko · Kopi, Teh & Camilan Hangat
        </p>
      </header>

      {/* Sage Middle Section with Login Form + Figma Quick Role Cards */}
      <main className="flex-1 bg-[#7F9995] border-y-[1.5px] border-[#141414] px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <p className="font-brand text-2xl sm:text-3xl text-[#141414]">
              tongkrongan hiroo
            </p>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.2em] text-[#141414]/80 mt-1">
              Autentikasi Pengguna Kasir & Pemilik
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Standard Username + Password Login Form (PRD FR-1, FR-2) */}
            <section className="lg:col-span-5 hiroo-card p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#141414]">Masuk ke Sistem</h2>
                <p className="mt-1 text-sm text-[#5A554E]">
                  Setiap pergantian shift kasir wajib login dengan akun masing-masing.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#141414] mb-1.5"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#5A554E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="contoh: siti atau faiz"
                        className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white pl-10 pr-4 py-2.5 text-sm text-[#141414] placeholder:text-[#9A938A] focus:outline-none focus:ring-2 focus:ring-[#141414]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#141414] mb-1.5"
                    >
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#5A554E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi"
                        className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white pl-10 pr-11 py-2.5 text-sm text-[#141414] placeholder:text-[#9A938A] focus:outline-none focus:ring-2 focus:ring-[#141414]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5A554E] hover:text-[#141414]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#C93B2B] bg-[#FDECEC] px-3.5 py-2.5 text-xs font-medium text-[#991B1B]"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {infoMsg && (
                    <div className="rounded-xl border border-[#5F9227] bg-[#EEF6E4] px-3.5 py-2.5 text-xs font-medium text-[#365911]">
                      {infoMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full hiroo-btn-dark rounded-full py-3 px-5 text-sm font-bold tracking-wide cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t border-[#141414]/15 flex items-center justify-between gap-2 text-xs text-[#5A554E]">
                <span>Akun uji tersedia di samping</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#141414] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Demo
                </button>
              </div>
            </section>

            {/* Figma-inspired Tactile Role Cards with Test Credentials */}
            <section className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Cashier Card */}
              <div className="flex flex-col">
                <div className="flex-1 rounded-[22px] border-[1.5px] border-[#141414] bg-[#EAE4D7] p-5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between font-mono-tabular text-[10px] text-[#5A554E] tracking-widest">
                    <span>AKUN UJI KASIR</span>
                    <span>|||| | || |||</span>
                  </div>

                  <div className="my-6 flex justify-center">
                    <div className="w-36 h-36 rounded-full bg-[#F5E74B] border-[1.5px] border-[#141414] flex flex-col items-center justify-center text-center p-3 shadow-sm">
                      <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#141414]">
                        Kasir
                      </span>
                      <span className="font-brand text-xl text-[#141414] leading-tight mt-0.5">
                        Point of Sale
                      </span>
                      <span className="text-[10px] text-[#141414]/80 mt-1">
                        Shift · Pesanan · Struk
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-[#141414]/30 px-3.5 py-2.5 text-xs space-y-1">
                    <div className="flex justify-between font-mono-tabular">
                      <span className="text-[#5A554E]">Username:</span>
                      <strong className="text-[#141414]">siti</strong>
                    </div>
                    <div className="flex justify-between font-mono-tabular">
                      <span className="text-[#5A554E]">Password:</span>
                      <strong className="text-[#141414]">kasir123</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('siti', 'kasir123')}
                    className="rounded-full border-[1.5px] border-[#141414] bg-[#FAF8F4] py-2.5 px-3 text-xs font-bold text-[#141414] hover:bg-white cursor-pointer"
                  >
                    Isi Form Kasir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('siti', 'kasir123')}
                    className="hiroo-btn-dark rounded-full py-2.5 px-3 text-xs font-bold cursor-pointer"
                  >
                    Masuk Kasir →
                  </button>
                </div>
              </div>

              {/* Owner Card */}
              <div className="flex flex-col">
                <div className="flex-1 rounded-[22px] border-[1.5px] border-[#141414] bg-[#EAE4D7] p-5 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between font-mono-tabular text-[10px] text-[#5A554E] tracking-widest">
                    <span>AKUN UJI OWNER</span>
                    <span>||| || | ||||</span>
                  </div>

                  <div className="my-6 flex justify-center">
                    <div className="w-32 h-32 rotate-45 rounded-2xl bg-[#3D2E3E] border-[1.5px] border-[#141414] flex items-center justify-center shadow-sm">
                      <div className="-rotate-45 text-center px-2 text-[#FAF8F4]">
                        <span className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#F5E74B] block">
                          Owner
                        </span>
                        <span className="text-sm font-bold leading-tight block mt-0.5">
                          Pengelola Toko
                        </span>
                        <span className="text-[10px] text-white/75 block mt-1">
                          Menu · Laporan · Akun
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-[#141414]/30 px-3.5 py-2.5 text-xs space-y-1">
                    <div className="flex justify-between font-mono-tabular">
                      <span className="text-[#5A554E]">Username:</span>
                      <strong className="text-[#141414]">faiz</strong>
                    </div>
                    <div className="flex justify-between font-mono-tabular">
                      <span className="text-[#5A554E]">Password:</span>
                      <strong className="text-[#141414]">owner123</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('faiz', 'owner123')}
                    className="rounded-full border-[1.5px] border-[#141414] bg-[#FAF8F4] py-2.5 px-3 text-xs font-bold text-[#141414] hover:bg-white cursor-pointer"
                  >
                    Isi Form Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('faiz', 'owner123')}
                    className="hiroo-btn-dark rounded-full py-2.5 px-3 text-xs font-bold cursor-pointer"
                  >
                    Masuk Owner →
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Moss Green Footer matching Figma */}
      <footer className="bg-[#5F9227] text-[#141414]">
        <div className="mx-auto max-w-6xl px-4 py-7 grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-xs">
          <div>
            <p className="font-mono-tabular font-bold uppercase tracking-wider">
              Kafe & Kedai Tongkrongan Hiroo
            </p>
            <p className="mt-1 text-[#141414]/85 leading-relaxed">
              Menu Kopi, Teh & Camilan Rp5.000 – Rp25.000 · Pencatatan Shift, Tunai & QRIS Terpadu
            </p>
          </div>
          <div className="text-left md:text-center">
            <p className="font-brand text-2xl">tongkrongan hiroo</p>
            <p className="font-mono-tabular text-[11px] mt-1 text-[#141414]/80">
              Pencatatan Pesanan, Transaksi & Rekap Kas Harian
            </p>
          </div>
          <div className="md:text-right font-mono-tabular text-[11px] text-[#141414]/85 space-y-1">
            <p>Kasir 2: username budi / kasir123</p>
            <p>Owner 2: username nadia / owner123</p>
          </div>
        </div>

        <div className="bg-[#141414] text-[#FAF8F4] py-2 overflow-hidden">
          <div className="animate-marquee font-mono-tabular text-[11px] uppercase tracking-[0.2em] whitespace-nowrap">
            <span className="mx-6">TONGKRONGAN HIROO POS</span>
            <span>•</span>
            <span className="mx-6">ES KOPI SUSU GULA AREN</span>
            <span>•</span>
            <span className="mx-6">PENCATATAN SHIFT & TUTUP KAS OTOMATIS</span>
            <span>•</span>
            <span className="mx-6">TUNAI & QRIS MANUAL TERDATA RAPI</span>
            <span>•</span>
            <span className="mx-6">TONGKRONGAN HIROO POS</span>
            <span>•</span>
            <span className="mx-6">ES KOPI SUSU GULA AREN</span>
            <span>•</span>
            <span className="mx-6">PENCATATAN SHIFT & TUTUP KAS OTOMATIS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
