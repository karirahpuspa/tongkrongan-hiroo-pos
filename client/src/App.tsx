import React, { useEffect, useMemo, useState } from 'react';
import { ActiveOrdersView } from './components/ActiveOrdersView';
import { CashierScreen } from './components/CashierScreen';
import { CloseShiftView } from './components/CloseShiftView';
import { HistoryView } from './components/HistoryView';
import { LoginScreen } from './components/LoginScreen';
import { OwnerAccountsView } from './components/OwnerAccountsView';
import { ArchitectureGuideView } from './components/OwnerArchitectureView';
import { OwnerMenuView } from './components/OwnerMenuView';
import { OwnerReportsView } from './components/OwnerReportsView';
import { AppTab, TopNav } from './components/TopNav';
import { PosProvider, usePos } from './store/posStore';
import { Order } from './types/pos';

const OWNER_ONLY_TABS: AppTab[] = [
  'kelola_menu',
  'laporan',
  'kelola_akun',
  'panduan_arsitektur',
];

const PosAppShell: React.FC = () => {
  const { currentUser, orders, authReady } = usePos();
  const [activeTab, setActiveTab] = useState<AppTab>('kasir');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setActiveTab('kasir');
      setEditingOrder(null);
      return;
    }
    if (currentUser.role === 'owner') {
      setActiveTab('laporan');
    } else {
      setActiveTab('kasir');
    }
  }, [currentUser?.id, currentUser?.role]);

  const activeProcessingCount = useMemo(
    () => orders.filter((o) => o.status === 'processing').length,
    [orders]
  );

  if (!authReady) {
    return <div className="min-h-screen bg-[#A3431B]" aria-busy="true" />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const handleSelectTab = (tab: AppTab) => {
    if (currentUser.role !== 'owner' && OWNER_ONLY_TABS.includes(tab)) {
      setActiveTab('kasir');
      return;
    }
    setActiveTab(tab);
  };

  const handleEditPendingOrder = (order: Order) => {
    setEditingOrder(order);
    setActiveTab('kasir');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#A3431B] text-[#141414]">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        activeProcessingCount={activeProcessingCount}
      />

      <main className="flex-1 pt-2 sm:pt-3">
        {activeTab === 'kasir' && (
          <CashierScreen
            editingOrder={editingOrder}
            onClearEditingOrder={() => setEditingOrder(null)}
          />
        )}
        {activeTab === 'pesanan_aktif' && <ActiveOrdersView />}
        {activeTab === 'riwayat' && (
          <HistoryView onEditPendingOrder={handleEditPendingOrder} />
        )}
        {activeTab === 'tutup_shift' && (
          <CloseShiftView onBackToCashier={() => setActiveTab('kasir')} />
        )}
        {activeTab === 'kelola_menu' && <OwnerMenuView />}
        {activeTab === 'laporan' && <OwnerReportsView />}
        {activeTab === 'kelola_akun' && <OwnerAccountsView />}
        {activeTab === 'panduan_arsitektur' && <ArchitectureGuideView />}
      </main>

      <footer className="no-print mt-auto bg-[#5F9227] border-t-[1.5px] border-[#141414] px-4 py-4 text-xs text-[#141414]">
        <div className="mx-auto max-w-[1400px] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-brand text-xl">tongkrongan hiroo</span>
            <span className="text-[#141414]/60">·</span>
            <span className="font-mono-tabular text-[11px]">
              Sistem Kasir & Operasional Harian
            </span>
          </div>
          <p className="font-mono-tabular text-[11px] text-[#141414]/85">
            Pembayaran Tunai & QRIS · Tanpa Pajak & Tanpa Diskon
          </p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <PosProvider>
      <PosAppShell />
    </PosProvider>
  );
}
