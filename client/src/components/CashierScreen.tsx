import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { usePos } from '../store/posStore';
import { CartDraftItem, MenuCategory, Order, PaymentMethod } from '../types/pos';
import { formatRupiah, formatTimeWIB, generateOrderNumber } from '../utils/format';
import { MenuArtwork } from './MenuArtwork';
import { ReceiptModal } from './ReceiptModal';
import { StartShiftView } from './StartShiftView';

interface CashierScreenProps {
  editingOrder: Order | null;
  onClearEditingOrder: () => void;
}

const CATEGORIES: ('Semua' | MenuCategory)[] = [
  'Semua',
  'Kopi',
  'Non-Kopi',
  'Makanan',
  'Cemilan',
];

export const CashierScreen: React.FC<CashierScreenProps> = ({
  editingOrder,
  onClearEditingOrder,
}) => {
  const {
    menus,
    orders,
    activeShift,
    createOrder,
    updatePendingOrderItems,
    payOrder,
    toggleMenuAvailability,
    sanitizeOrderForViewer,
  } = usePos();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | MenuCategory>('Semua');
  const [availabilityMode, setAvailabilityMode] = useState(false);

  // Per-card quick quantity selector before clicking + Tambah
  const [cardQty, setCardQty] = useState<Record<string, number>>({});

  // Cart state
  const [cartItems, setCartItems] = useState<CartDraftItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [qrisAccountNumber, setQrisAccountNumber] = useState('');
  const [qrisAccountName, setQrisAccountName] = useState('');

  // Mobile / Tablet portrait drawer
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Feedback & Receipt
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `idem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  );

  // Sync editingOrder into cart when triggered from HistoryView
  useEffect(() => {
    if (editingOrder) {
      setCartItems(
        editingOrder.items.map((it) => ({
          menu_id: it.menu_id,
          quantity: it.quantity,
        }))
      );
      setCustomerName(editingOrder.customer_name);
      setOrderNote(editingOrder.note);
      setFormError(null);
      setMobileCartOpen(true);
    }
  }, [editingOrder]);

  // ESC clears search (matches Figma UX)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement?.id === 'menu-search-input') {
        setSearch('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeMenus = useMemo(() => menus.filter((m) => m.is_active), [menus]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: activeMenus.length };
    for (const m of activeMenus) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }, [activeMenus]);

  const filteredMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeMenus.filter((m) => {
      const catMatch = selectedCategory === 'Semua' || m.category === selectedCategory;
      const qMatch =
        !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
      return catMatch && qMatch;
    });
  }, [activeMenus, selectedCategory, search]);

  const cartDetails = useMemo(() => {
    return cartItems
      .map((ci) => {
        const menu = menus.find((m) => m.id === ci.menu_id);
        if (!menu) return null;
        return {
          ...ci,
          menu,
          subtotal: menu.price * ci.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cartItems, menus]);

  const cartTotal = useMemo(
    () => cartDetails.reduce((acc, row) => acc + row.subtotal, 0),
    [cartDetails]
  );

  const totalItemCount = useMemo(
    () => cartDetails.reduce((acc, row) => acc + row.quantity, 0),
    [cartDetails]
  );

  const nextOrderNumberPreview = useMemo(() => {
    if (editingOrder) return editingOrder.order_number;
    if (!activeShift) return 'HRO-YYMMDD-001';
    const countOnDate = orders.filter(
      (o) => o.business_date === activeShift.business_date
    ).length;
    return generateOrderNumber(activeShift.business_date, countOnDate);
  }, [editingOrder, activeShift, orders]);

  // Block order creation if no active shift (FR-12)
  if (!activeShift) {
    return <StartShiftView />;
  }

  const getCardQty = (id: string) => cardQty[id] ?? 1;
  const setSingleCardQty = (id: string, val: number) => {
    setCardQty((prev) => ({ ...prev, [id]: Math.max(1, val) }));
  };

  const addToCart = (menuId: string, qtyToAdd: number) => {
    setFormError(null);
    setCartItems((prev) => {
      const existing = prev.find((i) => i.menu_id === menuId);
      if (existing) {
        return prev.map((i) =>
          i.menu_id === menuId ? { ...i, quantity: i.quantity + qtyToAdd } : i
        );
      }
      return [...prev, { menu_id: menuId, quantity: qtyToAdd }];
    });
    setSingleCardQty(menuId, 1);
  };

  const updateCartQty = (menuId: string, delta: number) => {
    setFormError(null);
    setCartItems((prev) =>
      prev
        .map((i) =>
          i.menu_id === menuId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (menuId: string) => {
    setCartItems((prev) => prev.filter((i) => i.menu_id !== menuId));
  };

  const resetCart = () => {
    setCartItems([]);
    setCustomerName('');
    setOrderNote('');
    setCashReceivedInput('');
    setQrisAccountNumber('');
    setQrisAccountName('');
    setFormError(null);
    setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    onClearEditingOrder();
    setMobileCartOpen(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const parsedCashReceived =
    cashReceivedInput.trim() === '' ? NaN : Number(cashReceivedInput);
  const cashChange =
    !Number.isNaN(parsedCashReceived) ? parsedCashReceived - cartTotal : -cartTotal;

  const handleSavePendingOnly = () => {
    setFormError(null);
    if (!customerName.trim()) {
      setFormError('Nama pelanggan wajib diisi.');
      return;
    }
    if (cartItems.length === 0) {
      setFormError('Keranjang pesanan masih kosong.');
      return;
    }

    if (editingOrder) {
      const res = updatePendingOrderItems(editingOrder.id, {
        customerName,
        note: orderNote,
        items: cartItems,
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      showToast(res.message);
      resetCart();
      return;
    }

    const res = createOrder({
      customerName,
      note: orderNote,
      items: cartItems,
      idempotencyKey,
    });
    if (!res.success) {
      setFormError(res.message);
      return;
    }
    showToast(res.message);
    resetCart();
  };

  const handlePayAndProcess = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Nama pelanggan wajib diisi.');
      return;
    }
    if (cartItems.length === 0) {
      setFormError('Keranjang pesanan masih kosong.');
      return;
    }

    if (paymentMethod === 'cash') {
      if (Number.isNaN(parsedCashReceived) || parsedCashReceived < cartTotal) {
        setFormError(
          `Uang diterima kurang dari total (${formatRupiah(cartTotal)}).`
        );
        return;
      }
    } else {
      if (!qrisAccountNumber.trim() || !qrisAccountName.trim()) {
        setFormError(
          'Nomor rekening / e-wallet dan nama pemilik wajib diisi untuk pembayaran QRIS.'
        );
        return;
      }
    }

    let targetOrder: Order | undefined;
    if (editingOrder) {
      const upd = updatePendingOrderItems(editingOrder.id, {
        customerName,
        note: orderNote,
        items: cartItems,
      });
      if (!upd.success || !upd.data) {
        setFormError(upd.message);
        return;
      }
      targetOrder = upd.data;
    } else {
      const created = createOrder({
        customerName,
        note: orderNote,
        items: cartItems,
        idempotencyKey,
      });
      if (!created.success || !created.data) {
        setFormError(created.message);
        return;
      }
      targetOrder = created.data;
    }

    const paid = payOrder({
      orderId: targetOrder.id,
      method: paymentMethod,
      amountPaid: paymentMethod === 'cash' ? parsedCashReceived : undefined,
      qrisAccountNumber: paymentMethod === 'qris' ? qrisAccountNumber : undefined,
      qrisAccountName: paymentMethod === 'qris' ? qrisAccountName : undefined,
    });

    if (!paid.success || !paid.data) {
      setFormError(paid.message);
      return;
    }

    const sanitized = sanitizeOrderForViewer(paid.data);
    resetCart();
    setReceiptOrder(sanitized);
    showToast(`Pesanan ${paid.data.order_number} dibayar & masuk Pesanan Aktif.`);
  };

  const renderCartPanelContent = () => (
    <form onSubmit={handlePayAndProcess} className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#141414]/15">
        <div>
          <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#5A554E]">
            {editingOrder ? 'Ubah Pesanan Pending' : 'Pesanan Baru'}
          </p>
          <h2 className="text-lg font-extrabold font-mono-tabular text-[#141414]">
            {nextOrderNumberPreview}
          </h2>
          <p className="font-mono-tabular text-[11px] text-[#5A554E]">
            Shift {activeShift.shift_code} · Buka {formatTimeWIB(activeShift.started_at)} WIB
          </p>
        </div>
        {editingOrder && (
          <button
            type="button"
            onClick={resetCart}
            className="rounded-lg border border-[#141414] bg-[#F5E74B] px-2.5 py-1 text-[11px] font-bold text-[#141414] cursor-pointer"
          >
            Batal Ubah
          </button>
        )}
      </div>

      {/* Customer Name (Required) & Order-Level Note (Optional) */}
      <div className="mt-3 space-y-2.5">
        <div>
          <label
            htmlFor="cart-customer-name"
            className="block font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#141414] mb-1"
          >
            Nama Pelanggan <span className="text-[#C93B2B]">*Wajib</span>
          </label>
          <input
            id="cart-customer-name"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Misal: Budi, Raka, Mbak Rina..."
            className="w-full rounded-xl border-[1.5px] border-[#141414] bg-white px-3.5 py-2 text-sm font-medium text-[#141414] placeholder:text-[#9A938A] focus:outline-none focus:ring-2 focus:ring-[#141414]"
          />
        </div>

        <div>
          <label
            htmlFor="cart-order-note"
            className="block font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#5A554E] mb-1"
          >
            Catatan Pesanan (Opsional · per pesanan)
          </label>
          <input
            id="cart-order-note"
            type="text"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Misal: less sugar, tanpa es, sambal pisah"
            className="w-full rounded-xl border border-[#141414]/40 bg-white px-3.5 py-2 text-xs text-[#141414] placeholder:text-[#9A938A] focus:outline-none focus:border-[#141414]"
          />
        </div>
      </div>

      {/* Itemized Cart List */}
      <div className="mt-3 flex-1 overflow-y-auto max-h-[240px] lg:max-h-[260px] pr-1 space-y-2">
        {cartDetails.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#141414]/30 bg-white/60 py-7 px-4 text-center text-xs text-[#5A554E]">
            Belum ada menu dipilih. Klik <strong>+ Tambah</strong> pada daftar menu.
          </div>
        ) : (
          cartDetails.map((row) => (
            <div
              key={row.menu_id}
              className="rounded-xl border border-[#141414]/20 bg-white px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#141414] truncate">{row.menu.name}</p>
                <p className="font-mono-tabular text-[11px] text-[#5A554E]">
                  {formatRupiah(row.menu.price)} × {row.quantity} ={' '}
                  <strong className="text-[#141414]">{formatRupiah(row.subtotal)}</strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCartQty(row.menu_id, -1)}
                  aria-label={`Kurangi ${row.menu.name}`}
                  className="w-7 h-7 rounded-lg border border-[#141414] bg-[#FAF8F4] flex items-center justify-center hover:bg-zinc-200 cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center font-mono-tabular text-xs font-bold">
                  {row.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateCartQty(row.menu_id, 1)}
                  aria-label={`Tambah ${row.menu.name}`}
                  className="w-7 h-7 rounded-lg border border-[#141414] bg-[#FAF8F4] flex items-center justify-center hover:bg-zinc-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromCart(row.menu_id)}
                  aria-label={`Hapus ${row.menu.name}`}
                  className="w-7 h-7 rounded-lg text-[#5A554E] hover:text-[#C93B2B] flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total Box (PRD: No Tax, No Discount) */}
      <div className="mt-3 rounded-2xl border-[1.5px] border-[#141414] bg-[#F6F2D4] px-4 py-3">
        <div className="flex items-center justify-between text-xs text-[#5A554E] font-mono-tabular">
          <span>TOTAL ITEM</span>
          <span>{totalItemCount} item</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-base sm:text-lg font-extrabold text-[#141414] font-mono-tabular">
          <span>TOTAL BAYAR</span>
          <span>{formatRupiah(cartTotal)}</span>
        </div>
      </div>

      {/* Payment Method (One method per order: Cash or QRIS) */}
      <div className="mt-3">
        <p className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#5A554E] mb-1.5">
          Metode Pembayaran (1 Metode per Pesanan)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('cash');
              setFormError(null);
            }}
            className={`rounded-xl border-[1.5px] py-2.5 px-3 text-xs font-bold cursor-pointer transition-colors ${
              paymentMethod === 'cash'
                ? 'bg-[#141414] text-white border-[#141414]'
                : 'bg-white text-[#141414] border-[#141414]/40 hover:border-[#141414]'
            }`}
          >
            Tunai / Cash
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('qris');
              setFormError(null);
            }}
            className={`rounded-xl border-[1.5px] py-2.5 px-3 text-xs font-bold cursor-pointer transition-colors ${
              paymentMethod === 'qris'
                ? 'bg-[#141414] text-white border-[#141414]'
                : 'bg-white text-[#141414] border-[#141414]/40 hover:border-[#141414]'
            }`}
          >
            QRIS Manual
          </button>
        </div>

        {paymentMethod === 'cash' ? (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="cash-received"
                className="font-mono-tabular text-[11px] font-semibold text-[#141414] whitespace-nowrap"
              >
                Uang Diterima:
              </label>
              <input
                id="cash-received"
                type="number"
                min={0}
                step={500}
                value={cashReceivedInput}
                onChange={(e) => setCashReceivedInput(e.target.value)}
                placeholder="0"
                className="w-36 rounded-lg border-[1.5px] border-[#141414] bg-white px-3 py-1.5 text-right font-mono-tabular text-sm font-bold text-[#141414] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cartTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setCashReceivedInput(String(cartTotal))}
                  className="rounded-lg border border-[#141414] bg-white px-2.5 py-1 text-[11px] font-mono-tabular font-semibold hover:bg-zinc-100 cursor-pointer"
                >
                  Pas
                </button>
              )}
              {[20000, 50000, 100000].map((nom) => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => setCashReceivedInput(String(nom))}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono-tabular font-semibold cursor-pointer ${
                    Number(cashReceivedInput) === nom
                      ? 'bg-[#141414] text-white border-[#141414]'
                      : 'bg-white text-[#141414] border-[#141414]/40 hover:border-[#141414]'
                  }`}
                >
                  {nom / 1000}rb
                </button>
              ))}
            </div>

            <div
              className={`rounded-xl border px-3.5 py-2 flex items-center justify-between font-mono-tabular text-xs font-bold ${
                cartTotal > 0 && !Number.isNaN(parsedCashReceived) && cashChange < 0
                  ? 'border-[#C93B2B] bg-[#FDECEC] text-[#991B1B]'
                  : 'border-[#141414] bg-[#5F9227] text-white'
              }`}
            >
              <span>KEMBALIAN:</span>
              <span>
                {cartTotal === 0 || Number.isNaN(parsedCashReceived)
                  ? 'Rp 0'
                  : cashChange < 0
                  ? `Kurang ${formatRupiah(Math.abs(cashChange))}`
                  : formatRupiah(cashChange)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 rounded-xl border-[1.5px] border-[#141414] bg-[#CBBCE6]/55 p-3 space-y-2">
            <div>
              <label
                htmlFor="qris-acc-number"
                className="block font-mono-tabular text-[10px] font-bold uppercase text-[#141414] mb-1"
              >
                Nomor Rekening / E-Wallet <span className="text-[#C93B2B]">*</span>
              </label>
              <input
                id="qris-acc-number"
                type="text"
                value={qrisAccountNumber}
                onChange={(e) => setQrisAccountNumber(e.target.value)}
                placeholder="Misal: 0812xxxx (GoPay) / BCA 123456"
                className="w-full rounded-lg border border-[#141414] bg-white px-3 py-1.5 text-xs font-mono-tabular text-[#141414] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="qris-acc-name"
                className="block font-mono-tabular text-[10px] font-bold uppercase text-[#141414] mb-1"
              >
                Nama Pemilik Rekening <span className="text-[#C93B2B]">*</span>
              </label>
              <input
                id="qris-acc-name"
                type="text"
                value={qrisAccountName}
                onChange={(e) => setQrisAccountName(e.target.value)}
                placeholder="Nama sesuai bukti transfer QRIS"
                className="w-full rounded-lg border border-[#141414] bg-white px-3 py-1.5 text-xs text-[#141414] focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-[#141414]/80 leading-snug">
              Catatan: Data rekening hanya tersimpan untuk Owner dan tidak tercetak di struk.
            </p>
          </div>
        )}
      </div>

      {formError && (
        <div
          role="alert"
          className="mt-2.5 rounded-xl border border-[#C93B2B] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#991B1B]"
        >
          {formError}
        </div>
      )}

      {/* Primary & Secondary CTAs */}
      <div className="mt-3 space-y-2">
        <button
          type="submit"
          className="w-full rounded-full bg-[#5F9227] border-[1.5px] border-[#141414] py-3 px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#527F20] transition-colors cursor-pointer"
        >
          {editingOrder ? 'Simpan Perubahan & Bayar →' : 'Bayar & Cetak Struk →'}
        </button>

        <button
          type="button"
          onClick={handleSavePendingOnly}
          className="w-full rounded-full border-[1.5px] border-[#141414] bg-white py-2.5 px-4 text-xs font-bold text-[#141414] hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          {editingOrder
            ? 'Simpan Perubahan (Tetap Belum Bayar)'
            : 'Simpan Belum Bayar (Pending)'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 pb-24 lg:pb-8">
      {/* Shift Info Banner (Clean operational context without fake API telemetry) */}
      <div className="mb-4 rounded-2xl border-[1.5px] border-[#141414] bg-[#5F9227] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#141414]">
        <div className="flex items-center gap-2 font-mono-tabular">
          <span>SHIFT AKTIF: {activeShift.shift_code}</span>
          <span>·</span>
          <span>KASIR: {activeShift.cashier_name.toUpperCase()}</span>
        </div>
        <div className="font-mono-tabular text-[11px] bg-[#FAF8F4] border border-[#141414] rounded-full px-3 py-0.5">
          Modal Awal: {formatRupiah(activeShift.opening_cash)}
        </div>
      </div>

      {toastMsg && (
        <div className="mb-4 rounded-2xl border-[1.5px] border-[#141414] bg-[#F5E74B] px-4 py-2.5 text-xs font-bold text-[#141414] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {toastMsg}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Responsive 2-Column Split: Menu Grid (Left) + Cart Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Menu Catalog Section */}
        <section className="lg:col-span-8 space-y-4">
          {/* Search Bar + Stock Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5A554E] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="menu-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama menu atau kode produk (KOP-01)..."
                className="w-full rounded-full border-[1.5px] border-[#141414] bg-[#FAF8F4] pl-10 pr-24 py-2.5 text-sm text-[#141414] placeholder:text-[#7E776E] focus:outline-none focus:ring-2 focus:ring-[#141414]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white border border-[#141414]/30 px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#141414] hover:bg-zinc-100 cursor-pointer"
                >
                  HAPUS
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAvailabilityMode((v) => !v)}
              className={`inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#141414] px-4 py-2.5 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                availabilityMode
                  ? 'bg-[#F5E74B] text-[#141414]'
                  : 'bg-[#FAF8F4] text-[#141414] hover:bg-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{availabilityMode ? 'Selesai Atur Stok' : 'Atur Tersedia / Habis'}</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap shrink-0 rounded-full border-[1.5px] border-[#141414] px-4 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#141414] text-[#FAF8F4]'
                      : 'bg-[#FAF8F4] text-[#141414] hover:bg-white'
                  }`}
                >
                  {cat} ({categoryCounts[cat] ?? 0})
                </button>
              );
            })}
          </div>

          {/* Menu Grid */}
          {filteredMenus.length === 0 ? (
            <div className="hiroo-card p-10 text-center">
              <p className="text-sm font-bold text-[#141414]">Menu tidak ditemukan</p>
              <p className="text-xs text-[#5A554E] mt-1">
                Coba kata kunci lain atau pilih kategori Semua.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMenus.map((menu) => {
                const qty = getCardQty(menu.id);
                const unavailable = !menu.is_available;

                return (
                  <article
                    key={menu.id}
                    className={`hiroo-card p-3.5 flex flex-col justify-between transition-opacity ${
                      unavailable && !availabilityMode ? 'opacity-70' : ''
                    }`}
                  >
                    <div>
                      <div className="relative rounded-2xl border border-[#141414]/25 overflow-hidden aspect-[4/3]">
                        <MenuArtwork menu={menu} className="w-full h-full" />

                        <div className="absolute left-2.5 bottom-2.5 rounded-full bg-white/95 border border-[#141414] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#141414]">
                          {menu.code}
                        </div>

                        {unavailable ? (
                          <div className="absolute right-2.5 top-2.5 rounded-full bg-[#C93B2B] border border-[#141414] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold text-white uppercase">
                            Habis
                          </div>
                        ) : menu.badge_text ? (
                          <div className="absolute right-2.5 top-2.5 rounded-full bg-[#F5E74B] border border-[#141414] px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold text-[#141414]">
                            {menu.badge_text}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3">
                        <h3 className="text-sm font-extrabold text-[#141414] leading-snug">
                          {menu.name}
                        </h3>
                        <p className="mt-0.5 font-mono-tabular text-base font-extrabold text-[#A3431B]">
                          {formatRupiah(menu.price)}
                        </p>
                        <p className="mt-1 text-[11px] text-[#5A554E] truncate">
                          {menu.serving_label}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#141414]/10">
                      {availabilityMode ? (
                        <button
                          type="button"
                          onClick={() => {
                            const res = toggleMenuAvailability(menu.id);
                            showToast(res.message);
                          }}
                          className={`w-full rounded-full border-[1.5px] border-[#141414] py-2 px-3 text-xs font-bold cursor-pointer ${
                            menu.is_available
                              ? 'bg-[#EEF6E4] text-[#365911] hover:bg-[#FDECEC] hover:text-[#991B1B]'
                              : 'bg-[#FDECEC] text-[#991B1B] hover:bg-[#EEF6E4] hover:text-[#365911]'
                          }`}
                        >
                          {menu.is_available
                            ? 'Status: Tersedia (Klik jika Habis)'
                            : 'Status: Habis (Klik jika Tersedia)'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center rounded-full border border-[#141414] bg-white px-1 py-0.5">
                            <button
                              type="button"
                              disabled={unavailable}
                              onClick={() => setSingleCardQty(menu.id, qty - 1)}
                              aria-label={`Kurangi jumlah ${menu.name}`}
                              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono-tabular text-xs font-bold">
                              {qty}
                            </span>
                            <button
                              type="button"
                              disabled={unavailable}
                              onClick={() => setSingleCardQty(menu.id, qty + 1)}
                              aria-label={`Tambah jumlah ${menu.name}`}
                              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={unavailable}
                            onClick={() => addToCart(menu.id, qty)}
                            className="flex-1 hiroo-btn-dark rounded-full py-2 px-3 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {unavailable ? 'Habis' : '+ Tambah'}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Desktop / Tablet Landscape Sticky Cart */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-4">
          <div className="hiroo-card p-5">{renderCartPanelContent()}</div>
        </aside>
      </div>

      {/* Mobile / Portrait Tablet Sticky Floating Cart Trigger (<= 15% mobile height) */}
      <div className="lg:hidden fixed bottom-3 inset-x-3 z-40">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="w-full rounded-full border-[1.5px] border-[#141414] bg-[#141414] text-[#FAF8F4] px-5 py-3.5 shadow-lg flex items-center justify-between text-xs sm:text-sm font-bold cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#F5E74B]" />
            <span>
              {editingOrder
                ? `Ubah ${editingOrder.order_number}`
                : `Keranjang (${totalItemCount} item)`}
            </span>
          </span>
          <span className="font-mono-tabular text-[#F5E74B]">
            {formatRupiah(cartTotal)} · Bayar →
          </span>
        </button>
      </div>

      {/* Mobile / Portrait Tablet Slide-Up Cart Modal */}
      {mobileCartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keranjang Pesanan"
        >
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#FAF8F4] border-t-[1.5px] sm:border-[1.5px] border-[#141414] rounded-t-[24px] sm:rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-tabular text-xs font-bold uppercase text-[#5A554E]">
                Detail Keranjang & Pembayaran
              </span>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                aria-label="Tutup keranjang"
                className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderCartPanelContent()}
          </div>
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
};
