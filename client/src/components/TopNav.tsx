import React from 'react';
import { LogOut } from 'lucide-react';
import { usePos } from '../store/posStore';
import { formatShortDateID } from '../utils/format';

export type AppTab =
  | 'kasir'
  | 'pesanan_aktif'
  | 'riwayat'
  | 'tutup_shift'
  | 'kelola_menu'
  | 'laporan'
  | 'kelola_akun'
  | 'panduan_arsitektur';

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  activeProcessingCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  activeProcessingCount,
}) => {
  const { currentUser, activeShift, logout } = usePos();
  if (!currentUser) return null;

  const isOwner = currentUser.role === 'owner';

  const navItems: { id: AppTab; label: string; badge?: number; ownerOnly?: boolean }[] = [
    { id: 'kasir', label: 'Kasir' },
    { id: 'pesanan_aktif', label: 'Pesanan Aktif', badge: activeProcessingCount },
    { id: 'riwayat', label: 'Riwayat' },
    { id: 'tutup_shift', label: 'Tutup Kasir' },
    { id: 'kelola_menu', label: 'Kelola Menu', ownerOnly: true },
    { id: 'laporan', label: 'Laporan', ownerOnly: true },
    { id: 'kelola_akun', label: 'Akun', ownerOnly: true },
    { id: 'panduan_arsitektur', label: 'Kode & DB', ownerOnly: true },
  ];

  const visibleItems = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <header className="no-print px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
      <div className="mx-auto max-w-[1400px] flex flex-wrap items-center justify-between gap-3">
        {/* Zone 1: Brand + Logout */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-brand text-2xl sm:text-3xl text-[#141414] whitespace-nowrap">
            tongkrongan Hiroo
          </span>
        </div>

        {/* Zone 2: Floating Figma Pill Nav Bar */}
        <nav
          aria-label="Navigasi Utama"
          className="order-3 lg:order-2 w-full lg:w-auto overflow-x-auto"
        >
          <div className="inline-flex min-w-max items-center gap-1 rounded-full border border-white/35 bg-[#843312]/90 p-1.5 shadow-sm">
            {visibleItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`whitespace-nowrap shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#FAF8F4] text-[#141414] shadow-sm'
                      : 'text-[#FAF8F4]/90 hover:bg-white/15'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono-tabular font-bold ${
                        active
                          ? 'bg-[#A3431B] text-white'
                          : 'bg-[#F5E74B] text-[#141414]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Zone 3: User Info + Logout */}
        <div className="order-2 lg:order-3 flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/30 bg-[#843312]/80 px-3.5 py-1.5 text-xs text-[#FAF8F4]">
            <span className="font-mono-tabular uppercase tracking-wide font-semibold">
              {isOwner ? 'Owner' : 'Kasir'}: {currentUser.name.split(' ')[0]}
            </span>
            {activeShift && (
              <>
                <span className="text-white/40">·</span>
                <span className="font-mono-tabular text-[#F5E74B]">
                  {formatShortDateID(activeShift.business_date)}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#141414] px-3.5 py-1.5 text-xs font-semibold text-[#FAF8F4] hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
