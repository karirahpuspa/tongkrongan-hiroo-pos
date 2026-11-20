import React, { useMemo, useState } from 'react';
import {
  Ban,
  CreditCard,
  Edit3,
  Printer,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { usePos } from '../store/posStore';
import { Order, OrderStatus, PaymentMethod } from '../types/pos';
import {
  formatDateID,
  formatRupiah,
  formatTimeWIB,
} from '../utils/format';
import { ReceiptModal } from './ReceiptModal';

interface HistoryViewProps {
  onEditPendingOrder: (order: Order) => void;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Belum Bayar',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  onEditPendingOrder,
}) => {
  const {
    currentUser,
    activeShift,
    orders,
    menus,
    payOrder,
    cancelOrder,
    ownerCorrectOrder,
    sanitizeOrderForViewer,
  } = usePos();

  const isOwner = currentUser?.role === 'owner';

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<
    'all' | 'cash' | 'qris' | 'pending_payment' | 'cancelled'
  >('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Pay pending modal
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  const [qrisAccNum, setQrisAccNum] = useState('');
  const [qrisAccName, setQrisAccName] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  // Cancel modal
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Owner correction modal
  const [correctingOrder, setCorrectingOrder] = useState<Order | null>(null);
  const [corrCustomer, setCorrCustomer] = useState('');
  const [corrNote, setCorrNote] = useState('');
  const [corrQuantities, setCorrQuantities] = useState<Record<string, number>>({});
  const [corrError, setCorrError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // PRD 6.1: Cashier sees own shift/orders; Owner sees all
  const scopedOrders = useMemo(() => {
    const base = isOwner
      ? orders
      : orders.filter(
          (o) =>
            (activeShift && o.shift_id === activeShift.id) ||
            o.cashier_id === currentUser?.id
        );
    return base.map((o) => sanitizeOrderForViewer(o));
  }, [orders, isOwner, activeShift, currentUser, sanitizeOrderForViewer]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedOrders.filter((o) => {
      const matchTab =
        filterTab === 'all'
          ? true
          : filterTab === 'cash'
          ? o.payment?.method === 'cash'
          : filterTab === 'qris'
          ? o.payment?.method === 'qris'
          : o.status === filterTab;
      const matchSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.items.some((i) => i.menu_name.toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [scopedOrders, filterTab, search]);

  const stats = useMemo(() => {
    const paidOrders = scopedOrders.filter((o) => o.payment?.status === 'paid');
    const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);
    const cashSales = paidOrders
      .filter((o) => o.payment?.method === 'cash')
      .reduce((s, o) => s + o.total, 0);
    const qrisSales = paidOrders
      .filter((o) => o.payment?.method === 'qris')
      .reduce((s, o) => s + o.total, 0);
    const cancelledCount = scopedOrders.filter(
      (o) => o.status === 'cancelled'
    ).length;

    return {
      totalTx: paidOrders.length,
      cancelledCount,
      totalSales,
      cashSales,
      qrisSales,
    };
  }, [scopedOrders]);

  const selectedOrder = useMemo(() => {
    const target =
      filteredOrders.find((o) => o.id === selectedOrderId) ??
      filteredOrders[0] ??
      null;
    return target;
  }, [filteredOrders, selectedOrderId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleOpenPayModal = (order: Order) => {
    setPayingOrder(order);
    setPayMethod('cash');
    setCashInput(String(order.total));
    setQrisAccNum('');
    setQrisAccName('');
    setPayError(null);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOrder) return;
    setPayError(null);

    const res = payOrder({
      orderId: payingOrder.id,
      method: payMethod,
      amountPaid: payMethod === 'cash' ? Number(cashInput) : undefined,
      qrisAccountNumber: payMethod === 'qris' ? qrisAccNum : undefined,
      qrisAccountName: payMethod === 'qris' ? qrisAccName : undefined,
    });

    if (!res.success || !res.data) {
      setPayError(res.message);
      return;
    }

    setPayingOrder(null);
    setReceiptOrder(sanitizeOrderForViewer(res.data));
    showToast(res.message);
  };

  const handleSubmitCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setCancelError(null);
    const res = cancelOrder(cancellingOrder.id, cancelReason);
    if (!res.success) {
      setCancelError(res.message);
      return;
    }
    setCancellingOrder(null);
    setCancelReason('');
    showToast(res.message);
  };

  const openCorrectionModal = (order: Order) => {
    setCorrectingOrder(order);
    setCorrCustomer(order.customer_name);
    setCorrNote(order.note);
    const map: Record<string, number> = {};
    for (const it of order.items) {
      map[it.menu_id] = it.quantity;
    }
    setCorrQuantities(map);
    setCorrError(null);
  };

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingOrder) return;
    setCorrError(null);
    const items = Object.entries(corrQuantities)
      .filter(([, q]) => q > 0)
      .map(([menu_id, quantity]) => ({ menu_id, quantity }));

    const res = ownerCorrectOrder(correctingOrder.id, {
      customerName: corrCustomer,
      note: corrNote,
      items,
    });
    if (!res.success) {
      setCorrError(res.message);
      return;
    }
    setCorrectingOrder(null);
    showToast(res.message);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-10">
      {/* Top 4 Summary Cards matching Figma Riwayat */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Transaksi Lunas
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono-tabular">
              {stats.totalTx}
            </span>
            {stats.cancelledCount > 0 && (
              <span className="text-[11px] font-mono-tabular text-[#C93B2B] font-semibold">
                {stats.cancelledCount} dibatalkan
              </span>
            )}
          </div>
        </div>

        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Total Penjualan
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#141414]">
            {formatRupiah(stats.totalSales)}
          </p>
        </div>

        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            Tunai (Cash)
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#141414]">
            {formatRupiah(stats.cashSales)}
          </p>
        </div>

        <div className="hiroo-card p-4">
          <p className="font-mono-tabular text-[11px] uppercase text-[#5A554E]">
            QRIS
          </p>
          <p className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#141414]">
            {formatRupiah(stats.qrisSales)}
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="mb-4 rounded-2xl border-[1.5px] border-[#141414] bg-[#F5E74B] px-4 py-2.5 text-xs font-bold text-[#141414]">
          {toastMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List Column */}
        <section className="lg:col-span-7 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5A554E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor pesanan (HRO-...), nama pelanggan, atau menu..."
              className="w-full rounded-full border-[1.5px] border-[#141414] bg-[#FAF8F4] pl-10 pr-4 py-2.5 text-sm text-[#141414] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: `Semua (${scopedOrders.length})` },
              { id: 'cash', label: 'Tunai' },
              { id: 'qris', label: 'QRIS' },
              { id: 'pending_payment', label: 'Belum Bayar' },
              { id: 'cancelled', label: 'Dibatalkan' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as typeof filterTab)}
                className={`whitespace-nowrap shrink-0 rounded-full border-[1.5px] border-[#141414] px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-[#141414] text-white'
                    : 'bg-[#FAF8F4] text-[#141414] hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="hiroo-card p-8 text-center text-xs text-[#5A554E]">
              Belum ada transaksi yang sesuai filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isCancelled = order.status === 'cancelled';
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left rounded-2xl border-[1.5px] p-4 transition-colors cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                      isCancelled
                        ? 'bg-[#E5B8A8] border-[#141414]/60'
                        : isSelected
                        ? 'bg-white border-[#141414] ring-2 ring-[#141414]'
                        : 'bg-[#FAF8F4] border-[#141414] hover:bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-tabular text-xs font-extrabold text-[#141414]">
                          {order.order_number}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-[#5A554E]">
                          {formatTimeWIB(order.created_at)} WIB
                        </span>
                        <span className="text-xs font-bold text-[#141414]">
                          · {order.customer_name}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-xs text-[#5A554E] truncate max-w-md ${
                          isCancelled ? 'line-through' : ''
                        }`}
                      >
                        {order.items.length} item ·{' '}
                        {order.items
                          .map((i) => `${i.quantity}x ${i.menu_name}`)
                          .join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono-tabular text-sm font-extrabold ${
                          isCancelled ? 'line-through text-[#5A554E]' : 'text-[#141414]'
                        }`}
                      >
                        {formatRupiah(order.total)}
                      </span>
                      {order.payment && (
                        <span className="rounded-full border border-[#141414] bg-[#CBBCE6] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold uppercase">
                          {order.payment.method === 'cash' ? 'Tunai' : 'QRIS'}
                        </span>
                      )}
                      <span
                        className={`rounded-full border border-[#141414] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                          order.status === 'completed'
                            ? 'bg-[#5F9227] text-white'
                            : order.status === 'processing'
                            ? 'bg-[#F5E74B] text-[#141414]'
                            : order.status === 'pending_payment'
                            ? 'bg-white text-[#B45309]'
                            : 'bg-[#C93B2B] text-white'
                        }`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Detail Panel */}
        <aside className="lg:col-span-5">
          {selectedOrder ? (
            <div className="hiroo-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#141414]/15">
                <div>
                  <p className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#5A554E]">
                    Detail Transaksi
                  </p>
                  <h2 className="font-mono-tabular text-lg font-extrabold text-[#141414]">
                    {selectedOrder.order_number}
                  </h2>
                  <p className="text-xs text-[#5A554E]">
                    {formatDateID(selectedOrder.business_date)} ·{' '}
                    {formatTimeWIB(selectedOrder.created_at)} WIB
                  </p>
                </div>
                <span className="rounded-full border border-[#141414] bg-[#F5E74B] px-3 py-1 font-mono-tabular text-[11px] font-bold">
                  {STATUS_LABELS[selectedOrder.status]}
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5A554E]">Pelanggan</span>
                  <strong className="text-[#141414]">
                    {selectedOrder.customer_name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A554E]">Kasir</span>
                  <span className="text-[#141414]">{selectedOrder.cashier_name}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#141414]/15 pt-3">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#141414]">{item.menu_name}</p>
                      <p className="font-mono-tabular text-[11px] text-[#5A554E]">
                        {item.quantity} × {formatRupiah(item.unit_price)}
                      </p>
                    </div>
                    <strong className="font-mono-tabular text-[#141414]">
                      {formatRupiah(item.subtotal)}
                    </strong>
                  </div>
                ))}
              </div>

              {selectedOrder.note && (
                <div className="rounded-xl border border-[#141414]/25 bg-white px-3 py-2 text-xs">
                  <strong>Catatan Pesanan: </strong>
                  {selectedOrder.note}
                </div>
              )}

              <div className="rounded-2xl border-[1.5px] border-[#141414] bg-[#F6F2D4] px-4 py-3">
                <div className="flex justify-between items-center font-mono-tabular">
                  <span className="text-xs font-bold">TOTAL AKHIR</span>
                  <strong className="text-lg font-extrabold">
                    {formatRupiah(selectedOrder.total)}
                  </strong>
                </div>
                {selectedOrder.payment && (
                  <div className="mt-2 pt-2 border-t border-[#141414]/15 text-xs font-mono-tabular space-y-1">
                    <div className="flex justify-between">
                      <span>Metode</span>
                      <strong className="uppercase">
                        {selectedOrder.payment.method === 'cash' ? 'Tunai' : 'QRIS'}
                      </strong>
                    </div>
                    {selectedOrder.payment.method === 'cash' && (
                      <>
                        <div className="flex justify-between">
                          <span>Uang Diterima</span>
                          <span>
                            {formatRupiah(selectedOrder.payment.amount_paid)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kembalian</span>
                          <span>
                            {formatRupiah(selectedOrder.payment.change_amount)}
                          </span>
                        </div>
                      </>
                    )}
                    {/* FR-34: Only Owner sees saved QRIS account number / owner name */}
                    {selectedOrder.payment.method === 'qris' && (
                      <div className="pt-1">
                        {isOwner ? (
                          <div className="rounded-lg bg-[#CBBCE6]/60 border border-[#141414] p-2 space-y-0.5 text-[11px]">
                            <p className="font-bold">Data Rekening QRIS (Owner):</p>
                            <p>
                              No. Rek/E-Wallet:{' '}
                              <strong>
                                {selectedOrder.payment.qris_account_number ?? '-'}
                              </strong>
                            </p>
                            <p>
                              Atas Nama:{' '}
                              <strong>
                                {selectedOrder.payment.qris_account_name ?? '-'}
                              </strong>
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#5A554E]">
                            Data rekening QRIS terenkripsi (khusus Owner).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedOrder.status === 'cancelled' && (
                <div className="rounded-xl border border-[#C93B2B] bg-[#FDECEC] p-3 text-xs text-[#991B1B]">
                  <p className="font-bold">Alasan Pembatalan:</p>
                  <p className="mt-0.5">{selectedOrder.cancel_reason}</p>
                  <p className="mt-1 font-mono-tabular text-[10px]">
                    Oleh {selectedOrder.cancelled_by} ·{' '}
                    {selectedOrder.cancelled_at
                      ? formatTimeWIB(selectedOrder.cancelled_at)
                      : '-'}{' '}
                    WIB
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                {selectedOrder.payment && (
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(selectedOrder)}
                    className="w-full hiroo-btn-dark rounded-full py-2.5 px-4 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Ulang Struk</span>
                  </button>
                )}

                {selectedOrder.status === 'pending_payment' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPayModal(selectedOrder)}
                      className="rounded-full bg-[#5F9227] border-[1.5px] border-[#141414] py-2.5 px-3 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Bayar Sekarang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditPendingOrder(selectedOrder)}
                      className="rounded-full border-[1.5px] border-[#141414] bg-white py-2.5 px-3 text-xs font-bold text-[#141414] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah Pesanan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingOrder(selectedOrder);
                        setCancelReason('');
                        setCancelError(null);
                      }}
                      className="sm:col-span-2 rounded-full border-[1.5px] border-[#C93B2B] bg-white py-2.5 px-3 text-xs font-bold text-[#C93B2B] inline-flex items-center justify-center gap-1.5 hover:bg-[#FDECEC] cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Batalkan Pesanan</span>
                    </button>
                  </div>
                )}

                {isOwner &&
                  (selectedOrder.status === 'processing' ||
                    selectedOrder.status === 'completed') && (
                    <button
                      type="button"
                      onClick={() => openCorrectionModal(selectedOrder)}
                      className="w-full rounded-full border-[1.5px] border-[#141414] bg-[#F5E74B]/70 py-2.5 px-4 text-xs font-bold text-[#141414] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Koreksi Pesanan (Khusus Owner)</span>
                    </button>
                  )}
              </div>
            </div>
          ) : (
            <div className="hiroo-card p-8 text-center text-xs text-[#5A554E]">
              Pilih transaksi di sebelah kiri untuk melihat detail struk.
            </div>
          )}
        </aside>
      </div>

      {/* Pay Pending Order Modal */}
      {payingOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitPayment}
            className="w-full max-w-md hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                Bayar {payingOrder.order_number}
              </h3>
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#F6F2D4] border border-[#141414] p-3 flex justify-between font-mono-tabular text-sm font-bold">
              <span>Total Tagihan ({payingOrder.customer_name})</span>
              <span>{formatRupiah(payingOrder.total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayMethod('cash')}
                className={`rounded-xl border-[1.5px] py-2 text-xs font-bold cursor-pointer ${
                  payMethod === 'cash'
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-white border-[#141414]/40'
                }`}
              >
                Tunai
              </button>
              <button
                type="button"
                onClick={() => setPayMethod('qris')}
                className={`rounded-xl border-[1.5px] py-2 text-xs font-bold cursor-pointer ${
                  payMethod === 'qris'
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-white border-[#141414]/40'
                }`}
              >
                QRIS
              </button>
            </div>

            {payMethod === 'cash' ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold">Uang Diterima</label>
                <input
                  type="number"
                  min={0}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white px-3.5 py-2 font-mono-tabular text-sm font-bold"
                />
                <p className="font-mono-tabular text-xs">
                  Kembalian:{' '}
                  <strong>
                    {Number(cashInput) >= payingOrder.total
                      ? formatRupiah(Number(cashInput) - payingOrder.total)
                      : 'Uang kurang'}
                  </strong>
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Nomor Rekening / E-Wallet *
                  </label>
                  <input
                    type="text"
                    value={qrisAccNum}
                    onChange={(e) => setQrisAccNum(e.target.value)}
                    placeholder="0812xxxx / BCA 123456"
                    className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Nama Pemilik Rekening *
                  </label>
                  <input
                    type="text"
                    value={qrisAccName}
                    onChange={(e) => setQrisAccName(e.target.value)}
                    placeholder="Nama pemilik"
                    className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {payError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{payError}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-[#5F9227] border-[1.5px] border-[#141414] py-3 text-xs font-bold text-white cursor-pointer"
            >
              Konfirmasi Pembayaran & Cetak Struk
            </button>
          </form>
        </div>
      )}

      {/* Cancel Order Modal (Required Reason) */}
      {cancellingOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitCancel}
            className="w-full max-w-md hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#991B1B]">
                Batalkan {cancellingOrder.order_number}
              </h3>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#5A554E]">
              Pesanan dibatalkan tetap tersimpan di riwayat untuk audit dan tidak dihapus
              permanen.
            </p>
            <div>
              <label className="block text-xs font-bold mb-1">
                Alasan Pembatalan <span className="text-[#C93B2B]">*Wajib</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Misal: Pelanggan ganti pesanan / batal pesan"
                className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white px-3 py-2 text-xs"
              />
            </div>
            {cancelError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{cancelError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="flex-1 rounded-full border border-[#141414] bg-white py-2.5 text-xs font-bold cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-[#C93B2B] border-[1.5px] border-[#141414] py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                Batalkan Pesanan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Owner Post-Payment Correction Modal */}
      {correctingOrder && isOwner && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitCorrection}
            className="w-full max-w-lg hiroo-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                Koreksi Owner: {correctingOrder.order_number}
              </h3>
              <button
                type="button"
                onClick={() => setCorrectingOrder(null)}
                className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  value={corrCustomer}
                  onChange={(e) => setCorrCustomer(e.target.value)}
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Catatan Pesanan</label>
                <input
                  type="text"
                  value={corrNote}
                  onChange={(e) => setCorrNote(e.target.value)}
                  className="w-full rounded-xl border border-[#141414] bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border-y border-[#141414]/15 py-3">
              {menus
                .filter((m) => m.is_active)
                .map((m) => {
                  const q = corrQuantities[m.id] ?? 0;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-xs bg-white rounded-lg border border-[#141414]/15 px-3 py-1.5"
                    >
                      <span>
                        <strong>{m.name}</strong> ({formatRupiah(m.price)})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCorrQuantities((p) => ({
                              ...p,
                              [m.id]: Math.max(0, (p[m.id] ?? 0) - 1),
                            }))
                          }
                          className="w-6 h-6 rounded border border-[#141414] font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono-tabular font-bold">
                          {q}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCorrQuantities((p) => ({
                              ...p,
                              [m.id]: (p[m.id] ?? 0) + 1,
                            }))
                          }
                          className="w-6 h-6 rounded border border-[#141414] font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {corrError && (
              <p className="text-xs font-semibold text-[#C93B2B]">{corrError}</p>
            )}

            <button
              type="submit"
              className="w-full hiroo-btn-dark rounded-full py-2.5 text-xs font-bold cursor-pointer"
            >
              Simpan Koreksi Pesanan
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
