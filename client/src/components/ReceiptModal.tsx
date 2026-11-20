import React from 'react';
import { Printer, X } from 'lucide-react';
import { Order } from '../types/pos';
import { formatDateID, formatRupiah, formatTimeWIB } from '../utils/format';

interface ReceiptModalProps {
  order: Order;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Struk Pembayaran"
    >
      <div className="w-full max-w-md bg-[#FAF8F4] border-[1.5px] border-[#141414] rounded-[24px] p-5 sm:p-6 shadow-xl print-receipt-container">
        <div className="no-print flex items-center justify-between pb-3 mb-4 border-b border-[#141414]/15">
          <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#141414]">
            Pratinjau Struk Pembayaran
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Struk"
            className="p-1.5 rounded-full hover:bg-black/10 text-[#141414] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper Content (FR-38, FR-39, FR-40: NO QRIS account info!) */}
        <div className="bg-white border border-dashed border-[#141414]/40 rounded-xl p-5 font-mono-tabular text-xs text-[#141414] space-y-3">
          <div className="text-center border-b border-dashed border-[#141414]/35 pb-3">
            <p className="font-brand text-2xl text-[#141414]">Tongkrongan Hiroo</p>
            <p className="text-[11px] text-[#5A554E] mt-0.5">Kopi, Teh & Camilan Hangat</p>
          </div>

          <div className="space-y-1 text-[11px] border-b border-dashed border-[#141414]/35 pb-3">
            <div className="flex justify-between gap-2">
              <span className="text-[#5A554E]">No. Pesanan</span>
              <strong className="text-right">{order.order_number}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A554E]">Tanggal / Jam</span>
              <span className="text-right">
                {formatDateID(order.business_date)} · {formatTimeWIB(order.created_at)} WIB
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A554E]">Kasir</span>
              <span className="text-right">{order.cashier_name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A554E]">Pelanggan</span>
              <strong className="text-right">{order.customer_name}</strong>
            </div>
          </div>

          <div className="space-y-2 border-b border-dashed border-[#141414]/35 pb-3">
            {order.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="font-semibold">{item.menu_name}</div>
                <div className="flex justify-between text-[11px] text-[#5A554E]">
                  <span>
                    {item.quantity} x {formatRupiah(item.unit_price)}
                  </span>
                  <span className="text-[#141414] font-semibold">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>
              </div>
            ))}

            {order.note && (
              <div className="mt-2 rounded bg-[#FAF8F4] border border-[#141414]/20 px-2.5 py-1.5 text-[11px]">
                <span className="font-bold">Catatan: </span>
                <span>{order.note}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatRupiah(order.total)}</span>
            </div>

            {order.payment ? (
              <>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#5A554E]">Metode Bayar</span>
                  <strong className="uppercase">
                    {order.payment.method === 'cash' ? 'Tunai' : 'QRIS'}
                  </strong>
                </div>

                {order.payment.method === 'cash' && (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#5A554E]">Uang Diterima</span>
                      <span>{formatRupiah(order.payment.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>Kembalian</span>
                      <span>{formatRupiah(order.payment.change_amount)}</span>
                    </div>
                  </>
                )}

                {order.payment.method === 'qris' && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#5A554E]">Status Pembayaran</span>
                    <span>Lunas (Non-Tunai)</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-[11px] text-[#B45309]">
                <span>Status</span>
                <strong>Belum Dibayar</strong>
              </div>
            )}
          </div>

          <div className="text-center pt-3 border-t border-dashed border-[#141414]/35 text-[11px] text-[#5A554E]">
            <p>Terima kasih sudah mampir di Tongkrongan Hiroo!</p>
          </div>
        </div>

        <div className="no-print mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#141414] py-3 px-4 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-[1.5px] border-[#141414] bg-white py-3 px-5 text-xs font-bold text-[#141414] hover:bg-zinc-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
