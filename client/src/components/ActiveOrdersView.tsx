import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Printer } from 'lucide-react';
import { usePos } from '../store/posStore';
import { Order } from '../types/pos';
import {
  elapsedMinutesLabel,
  formatRupiah,
  formatTimeWIB,
} from '../utils/format';
import { ReceiptModal } from './ReceiptModal';

export const ActiveOrdersView: React.FC = () => {
  const { orders, completeOrder, sanitizeOrderForViewer } = usePos();
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Oldest first so kitchen/server prepares orders in arrival sequence
  const processingOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'processing')
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [orders]
  );

  const handleComplete = (orderId: string) => {
    const res = completeOrder(orderId);
    setToastMsg(res.message);
    setTimeout(() => {
      setToastMsg((prev) => (prev === res.message ? null : prev));
    }, 3000);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-10">
      <div className="mb-5 hiroo-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-tabular text-[11px] uppercase tracking-widest text-[#5A554E]">
            Antrean Penyajian (Pengganti Layar Dapur)
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">
            Pesanan Aktif ({processingOrders.length})
          </h1>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Sampaikan daftar pesanan ini ke dapur/bar secara manual, lalu tekan{' '}
            <strong>Selesai / Diserahkan</strong> setelah diberikan ke pelanggan.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="mb-4 rounded-2xl border-[1.5px] border-[#141414] bg-[#EEF6E4] px-4 py-3 text-xs font-bold text-[#365911]">
          {toastMsg}
        </div>
      )}

      {processingOrders.length === 0 ? (
        <div className="hiroo-card p-10 text-center">
          <p className="text-base font-bold text-[#141414]">
            Tidak ada pesanan yang sedang diproses
          </p>
          <p className="text-xs text-[#5A554E] mt-1">
            Pesanan baru yang sudah dibayar akan otomatis muncul di sini agar mudah disampaikan ke dapur.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {processingOrders.map((order) => (
            <article
              key={order.id}
              className="hiroo-card p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#141414]/15">
                  <div>
                    <span className="font-mono-tabular text-xs font-bold text-[#A3431B]">
                      {order.order_number}
                    </span>
                    <h2 className="text-lg font-extrabold text-[#141414] mt-0.5">
                      {order.customer_name}
                    </h2>
                  </div>
                  <div className="text-right font-mono-tabular text-[11px] text-[#5A554E]">
                    <div className="inline-flex items-center gap-1 rounded-full bg-[#F5E74B] border border-[#141414] px-2.5 py-0.5 text-[#141414] font-bold">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeWIB(order.created_at)} WIB</span>
                    </div>
                    <p className="mt-1">{elapsedMinutesLabel(order.created_at)}</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm bg-white rounded-xl border border-[#141414]/15 px-3 py-2"
                    >
                      <span className="font-semibold text-[#141414]">
                        {item.menu_name}
                      </span>
                      <span className="font-mono-tabular font-extrabold text-base text-[#141414] bg-[#F6F2D4] border border-[#141414]/30 rounded-lg px-2 py-0.5">
                        ×{item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.note && (
                  <div className="mt-3 rounded-xl border border-[#141414] bg-[#F5E74B]/55 px-3.5 py-2.5 text-xs">
                    <span className="font-bold uppercase tracking-wide text-[#141414] block text-[10px]">
                      Catatan Pesanan:
                    </span>
                    <span className="font-semibold text-[#141414]">{order.note}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#141414]/15 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono-tabular text-[#5A554E]">
                  <span>
                    Kasir: {order.cashier_name} ·{' '}
                    {order.payment?.method === 'cash' ? 'Tunai' : 'QRIS'}
                  </span>
                  <strong className="text-[#141414]">
                    {formatRupiah(order.total)}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleComplete(order.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#5F9227] border-[1.5px] border-[#141414] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#527F20] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesai / Diserahkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(sanitizeOrderForViewer(order))}
                    aria-label={`Lihat struk ${order.order_number}`}
                    className="rounded-full border-[1.5px] border-[#141414] bg-white p-2.5 text-[#141414] hover:bg-zinc-100 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
